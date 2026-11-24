import "server-only";
import { getConfig, type AppConfig } from "../config";
import { toPlainText } from "../format";
import { TtlCache } from "./cache";
import { parseHotPage } from "./hot-page";
import { fetchText, mapWithConcurrency, UpstreamError } from "./http";
import { fetchHotFeedViaMcp } from "./mcp";
import { parsePaperPage, type PaperPage } from "./paper-page";
import type { FeedItem, FeedPage, HotCandidate } from "./types";

type HotList = { candidates: HotCandidate[]; source: FeedPage["source"] };

const SCAN_CONCURRENCY = 6;

let candidateCache: TtlCache<HotList> | undefined;
let paperCache: TtlCache<PaperPage | null> | undefined;

function caches(config: AppConfig) {
  candidateCache ??= new TtlCache<HotList>(config.cacheTtlMs, 4);
  paperCache ??= new TtlCache<PaperPage | null>(config.cacheTtlMs, 1000);
  return { candidateCache, paperCache };
}

async function loadFromHotPage(config: AppConfig): Promise<HotList> {
  const html = await fetchText(`${config.baseUrl}/?sort=Hot`, {
    revalidateSeconds: config.cacheTtlMs / 1000,
  });
  if (!html) throw new UpstreamError("alphaXiv Hot page not found", 404, config.baseUrl);
  const candidates = parseHotPage(html).slice(0, config.hotFeedLimit);
  if (candidates.length === 0) {
    throw new UpstreamError(
      "Could not find the trending list on the alphaXiv Hot page (its markup may have changed)",
      null,
      config.baseUrl,
    );
  }
  return { candidates, source: "hot-page" };
}

async function loadHotList(config: AppConfig): Promise<HotList> {
  const useMcp = config.feedSource === "mcp" || (config.feedSource === "auto" && config.apiKey);
  if (!useMcp) return loadFromHotPage(config);
  if (!config.apiKey) {
    throw new Error("FEED_SOURCE=mcp requires ALPHAXIV_API_KEY to be set");
  }
  try {
    const candidates = await fetchHotFeedViaMcp({
      mcpUrl: config.mcpUrl,
      apiKey: config.apiKey,
      limit: config.hotFeedLimit,
      baseUrl: config.baseUrl,
    });
    return { candidates, source: "mcp" };
  } catch (error) {
    if (config.feedSource === "mcp") throw error;
    console.warn(
      `[feed] MCP get_hot_feed failed, falling back to the Hot page: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return loadFromHotPage(config);
  }
}

async function loadPaper(config: AppConfig, candidate: HotCandidate): Promise<PaperPage | null> {
  try {
    // Always read through the configured base URL rather than a URL taken from upstream markup.
    const url = `${config.baseUrl}/abs/${encodeURIComponent(candidate.id)}`;
    const html = await fetchText(url, { revalidateSeconds: config.cacheTtlMs / 1000 });
    return html ? parsePaperPage(html, config.baseUrl) : null;
  } catch (error) {
    // One unreachable paper should not break the feed; skip it this round.
    console.warn(
      `[feed] Skipping ${candidate.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

/** Merges the Hot listing and paper page into a feed item, or null if it has no explainer. */
export function toFeedItem(candidate: HotCandidate, paper: PaperPage | null): FeedItem | null {
  if (!paper?.explainer) return null;
  const listing = candidate.listing;
  const paperUrl = paper.canonicalUrl || candidate.url;
  return {
    id: candidate.id,
    title: toPlainText(paper.title || listing?.title || candidate.id),
    summary: toPlainText(paper.abstract || listing?.summary || ""),
    authors:
      paper.authors.length > 0
        ? paper.authors
        : (listing?.authors ?? []).map((name) => ({ name, profileUrl: null, affiliation: null })),
    views: paper.views ?? listing?.views ?? null,
    likes: paper.likes ?? listing?.likes ?? null,
    comments: paper.comments,
    publishedAt: paper.publishedAt ?? listing?.publishedAt ?? null,
    paperUrl,
    discussionUrl: `${paperUrl.split("#")[0]}#discussion`,
    hotRank: candidate.rank,
    explainer: paper.explainer,
  };
}

/**
 * Returns one page of the feed: Hot papers, in Hot order, that have an alphaXiv
 * video explainer. `cursor` is an index into the Hot list; papers without an
 * explainer are skipped, so a page may scan more papers than it returns.
 */
export async function getFeedPage(cursor = 0, limit = 5): Promise<FeedPage> {
  const config = getConfig();
  const { candidateCache, paperCache } = caches(config);
  const { candidates, source } = await candidateCache.get("hot", () => loadHotList(config));

  const items: FeedItem[] = [];
  let position = Math.max(0, cursor);
  while (items.length < limit && position < candidates.length) {
    const batch = candidates.slice(position, position + SCAN_CONCURRENCY);
    const papers = await mapWithConcurrency(batch, SCAN_CONCURRENCY, (candidate) =>
      paperCache.get(candidate.id, () => loadPaper(config, candidate)).catch(() => null),
    );
    for (let index = 0; index < batch.length; index += 1) {
      position += 1;
      const item = toFeedItem(batch[index] as HotCandidate, papers[index] ?? null);
      if (item) items.push(item);
      if (items.length >= limit) break;
    }
  }

  return {
    items,
    nextCursor: position < candidates.length ? position : null,
    scanned: candidates.length,
    source,
  };
}
