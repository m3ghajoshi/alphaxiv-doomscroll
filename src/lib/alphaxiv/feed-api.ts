import { z } from "zod";
import { toPlainText } from "../format";
import type { Author, Collection, FeedItem, VideoExplainer } from "./types";

/*
 * alphaXiv's web client loads its home feed from
 *   GET https://api.alphaxiv.org/papers/v3/feed?pageNum&sort&pageSize&interval&topics&linkBlogs
 * The endpoint is public but undocumented, so every field is parsed leniently:
 * unknown fields are ignored and a paper that doesn't fit is skipped, never fatal.
 */

const nullableString = z.string().nullish();
const nullableNumber = z.coerce.number().nullish().catch(null);

const videoSchema = z.object({
  videoUrl: z.string().min(1),
  videoThumbnailUrl: nullableString,
  videoCaptionUrl: nullableString,
  durationSeconds: nullableNumber,
});

const researcherSchema = z
  .object({
    slug: nullableString,
    name: nullableString,
    affiliation: nullableString,
    headline: nullableString,
  })
  .passthrough();

const paperSchema = z
  .object({
    universal_paper_id: z.string().min(1),
    title: z.string().min(1),
    abstract: nullableString,
    feed_description: nullableString,
    paper_summary: z
      .object({ summary: nullableString, feedDescription: nullableString })
      .passthrough()
      .nullish()
      .catch(null),
    video_explainer: videoSchema.nullish().catch(null),
    authors: z.array(z.string()).nullish().catch(null),
    full_authors_v2: z
      .array(z.object({ full_name: z.string(), researcher: researcherSchema.nullish().catch(null) }))
      .nullish()
      .catch(null),
    metrics: z
      .object({
        visits_count: z.object({ all: nullableNumber }).passthrough().nullish().catch(null),
        total_votes: nullableNumber,
        public_total_votes: nullableNumber,
      })
      .passthrough()
      .nullish()
      .catch(null),
    first_publication_date: nullableString,
    publication_date: nullableString,
  })
  .passthrough();

export type FeedApiPaper = z.infer<typeof paperSchema>;

const ARRAY_KEYS = ["papers", "data", "items", "results", "feed"];

/** Finds the list of papers in a response, whatever the wrapper looks like. */
export function extractPaperArray(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  for (const key of ARRAY_KEYS) {
    const value = record[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const nested = extractPaperArray(value);
      if (nested) return nested;
    }
  }
  // Fall back to the first array of objects that look like papers.
  for (const value of Object.values(record)) {
    if (
      Array.isArray(value) &&
      value.some((entry) => entry && typeof entry === "object" && "universal_paper_id" in entry)
    ) {
      return value;
    }
  }
  return null;
}

/** Parses one page of the feed. Returns null if the response has no paper list at all. */
export function parseFeedResponse(body: unknown): FeedApiPaper[] | null {
  const entries = extractPaperArray(body);
  if (!entries) return null;
  const papers: FeedApiPaper[] = [];
  for (const entry of entries) {
    const parsed = paperSchema.safeParse(entry);
    if (parsed.success) papers.push(parsed.data);
  }
  return papers;
}

export function buildFeedUrl(
  apiUrl: string,
  collection: Pick<Collection, "sort" | "interval">,
  pageNum: number,
  pageSize: number,
): string {
  const params = new URLSearchParams({
    pageNum: String(pageNum),
    sort: collection.sort,
    pageSize: String(pageSize),
    interval: collection.interval,
    topics: "[]",
    linkBlogs: "true",
  });
  return `${apiUrl}/papers/v3/feed?${params.toString()}`;
}

function httpsUrl(value: string | null | undefined, baseUrl: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,100}$/i;

function toAuthors(paper: FeedApiPaper): Author[] {
  if (paper.full_authors_v2 && paper.full_authors_v2.length > 0) {
    return paper.full_authors_v2.map(({ full_name, researcher }) => {
      const slug = researcher?.slug?.replace(/^@/, "");
      return {
        name: full_name,
        profileUrl: slug && SLUG_PATTERN.test(slug) ? `https://www.alphaxiv.org/@${slug}` : null,
        affiliation: researcher?.affiliation || researcher?.headline || null,
      };
    });
  }
  return (paper.authors ?? []).map((name) => ({ name, profileUrl: null, affiliation: null }));
}

export function toExplainer(paper: FeedApiPaper, baseUrl: string): VideoExplainer | null {
  const video = paper.video_explainer;
  const src = httpsUrl(video?.videoUrl, baseUrl);
  if (!video || !src) return null;
  return {
    src,
    poster: httpsUrl(video.videoThumbnailUrl, baseUrl),
    captions: httpsUrl(video.videoCaptionUrl, baseUrl),
  };
}

/** Maps a feed paper to a feed item, or null if it has no video explainer. */
export function feedPaperToItem(
  paper: FeedApiPaper,
  collection: Collection,
  rank: number,
  baseUrl: string,
): FeedItem | null {
  const explainer = toExplainer(paper, baseUrl);
  if (!explainer) return null;
  const paperUrl = `https://www.alphaxiv.org/abs/${encodeURIComponent(paper.universal_paper_id)}`;
  const summary =
    paper.paper_summary?.summary ||
    paper.abstract ||
    paper.feed_description ||
    paper.paper_summary?.feedDescription ||
    "";
  return {
    id: paper.universal_paper_id,
    title: toPlainText(paper.title),
    summary: toPlainText(summary),
    authors: toAuthors(paper),
    views: paper.metrics?.visits_count?.all ?? null,
    likes: paper.metrics?.public_total_votes ?? paper.metrics?.total_votes ?? null,
    // The feed has no comment count; the UI shows "Discuss" instead of a number.
    comments: null,
    publishedAt: paper.first_publication_date ?? paper.publication_date ?? null,
    paperUrl,
    discussionUrl: `${paperUrl}#discussion`,
    collection,
    rank,
    explainer,
  };
}
