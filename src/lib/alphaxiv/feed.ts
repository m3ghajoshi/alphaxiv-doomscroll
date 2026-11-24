import "server-only";
import { getConfig, type AppConfig } from "../config";
import { toPlainText } from "../format";
import { TtlCache } from "./cache";
import { buildFeedUrl, feedPaperToItem, parseFeedResponse } from "./feed-api";
import { fetchJson, fetchText, mapWithConcurrency, UpstreamError } from "./http";
import { fetchHotFeedViaMcp } from "./mcp";
import { parsePaperPage } from "./paper-page";
import type { Collection, FeedItem, FeedPage, HotCandidate } from "./types";

type Catalog = { items: FeedItem[]; scanned: number; source: FeedPage["source"] };

const PAPER_PAGE_CONCURRENCY = 6;

let catalogCache: TtlCache<Catalog> | undefined;

const FEED_PAGE_CONCURRENCY = 4;

/**
 * Reads each configured list (e.g. Hot, then Likes) from the public feed API.
 * Explainers are spread thinly through the lists (on 2026-11-24: 14 in the top
 * 121 Hot papers, 5 in the top 550 by likes), so several pages of each list are
 * fetched in parallel. Papers already seen in an earlier list are skipped, so
 * Hot papers keep their Hot rank. A failed page is logged and skipped.
 */
async function loadFromFeedApi(config: AppConfig): Promise<Catalog> {
  const requests = config.lists.flatMap((collection) =>
    Array.from({ length: config.maxPages }, (_, pageNum) => ({ collection, pageNum })),
  );
  let lastError: unknown;
  const pages = await mapWithConcurrency(requests, FEED_PAGE_CONCURRENCY, async (request) => {
    const url = buildFeedUrl(config.apiUrl, request.collection, request.pageNum, config.pageSize);
    try {
      const papers = parseFeedResponse(
        // Feed pages can be 4-5 MB (full author profiles), over Next's 2 MB fetch-cache
        // limit. The parsed catalog is cached in memory instead, so skip the fetch cache.
        await fetchJson(url, { revalidateSeconds: null, timeoutMs: 20_000 }),
      );
      if (papers === null) {
        throw new UpstreamError(
          "The alphaXiv feed response had no paper list (its format may have changed)",
          null,
          url,
        );
      }
      return papers;
    } catch (error) {
      lastError = error;
      console.warn(
        `[feed] ${request.collection.sort}/${request.collection.interval} page ${request.pageNum} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  });

  if (pages.every((page) => page === null)) {
    throw lastError instanceof Error
      ? lastError
      : new UpstreamError("Could not load the alphaXiv feed", null, config.apiUrl);
  }

  const items: FeedItem[] = [];
  const seen = new Set<string>();
  const ranks = new Map<Collection, number>();
  let scanned = 0;
  requests.forEach(({ collection }, index) => {
    for (const paper of pages[index] ?? []) {
      const rank = (ranks.get(collection) ?? 0) + 1;
      ranks.set(collection, rank);
      if (seen.has(paper.universal_paper_id)) continue;
      seen.add(paper.universal_paper_id);
      scanned += 1;
      const item = feedPaperToItem(paper, collection, rank, config.baseUrl);
      if (item) items.push(item);
    }
  });
  return { items, scanned, source: "feed-api" };
}

/**
 * Documented fallback: Hot paper IDs from the MCP `get_hot_feed` tool, then
 * each paper's /abs page for its explainer and metadata. Needs an API key.
 */
async function loadFromMcp(config: AppConfig): Promise<Catalog> {
  if (!config.apiKey) throw new Error("The MCP source needs ALPHAXIV_API_KEY to be set");
  const candidates = await fetchHotFeedViaMcp({
    mcpUrl: config.mcpUrl,
    apiKey: config.apiKey,
    limit: config.hotFeedLimit,
    baseUrl: config.baseUrl,
  });
  const hot: Collection = { sort: "Hot", interval: "30 Days", label: "Hot" };
  const items = await mapWithConcurrency(candidates, PAPER_PAGE_CONCURRENCY, (candidate) =>
    loadPaperItem(config, candidate, hot),
  );
  return {
    items: items.filter((item): item is FeedItem => item !== null),
    scanned: candidates.length,
    source: "mcp",
  };
}

async function loadPaperItem(
  config: AppConfig,
  candidate: HotCandidate,
  collection: Collection,
): Promise<FeedItem | null> {
  try {
    const html = await fetchText(`${config.baseUrl}/abs/${encodeURIComponent(candidate.id)}`, {
      revalidateSeconds: config.cacheTtlMs / 1000,
    });
    const paper = html ? parsePaperPage(html, config.baseUrl) : null;
    if (!paper?.explainer) return null;
    const paperUrl = paper.canonicalUrl || candidate.url;
    return {
      id: candidate.id,
      title: toPlainText(paper.title),
      summary: toPlainText(paper.abstract),
      authors: paper.authors,
      views: paper.views,
      likes: paper.likes,
      comments: paper.comments,
      publishedAt: paper.publishedAt,
      paperUrl,
      discussionUrl: `${paperUrl.split("#")[0]}#discussion`,
      collection,
      rank: candidate.rank,
      explainer: paper.explainer,
    };
  } catch (error) {
    console.warn(
      `[feed] Skipping ${candidate.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

async function loadCatalog(config: AppConfig): Promise<Catalog> {
  if (config.feedSource === "mcp") return loadFromMcp(config);
  if (config.feedSource === "feed-api" || !config.apiKey) return loadFromFeedApi(config);
  try {
    return await loadFromFeedApi(config);
  } catch (error) {
    console.warn(
      `[feed] Feed API failed, falling back to MCP: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return loadFromMcp(config);
  }
}

/**
 * Returns one page of the feed. The full list of explainers is small (tens of
 * videos), so it is built once per cache period and paged in memory; `cursor`
 * is an index into it.
 */
export async function getFeedPage(cursor = 0, limit = 5): Promise<FeedPage> {
  const config = getConfig();
  catalogCache ??= new TtlCache<Catalog>(config.cacheTtlMs, 2);
  const catalog = await catalogCache.get("catalog", () => loadCatalog(config));
  const start = Math.max(0, cursor);
  const end = start + limit;
  return {
    items: catalog.items.slice(start, end),
    nextCursor: end < catalog.items.length ? end : null,
    scanned: catalog.scanned,
    total: catalog.items.length,
    source: catalog.source,
  };
}
