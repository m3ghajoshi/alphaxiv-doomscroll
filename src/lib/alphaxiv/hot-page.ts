import { extractJsonLd } from "./html";
import { isValidPaperId, paperIdFromUrl } from "./ids";
import { articleSchema, interactionCount, jsonLdNodes } from "./schema";
import type { HotCandidate } from "./types";

/**
 * Parses the server-rendered alphaXiv Hot page. The page embeds a schema.org
 * ItemList ("Trending Papers") in JSON-LD, which is far more stable than the
 * visual markup.
 */
export function parseHotPage(html: string): HotCandidate[] {
  const nodes = extractJsonLd(html).flatMap(jsonLdNodes);
  const list = nodes.find((node) => node["@type"] === "ItemList");
  const elements = Array.isArray(list?.itemListElement) ? list.itemListElement : [];

  const candidates: HotCandidate[] = [];
  const seen = new Set<string>();
  elements.forEach((element: unknown, index: number) => {
    const record = (element ?? {}) as Record<string, unknown>;
    const parsed = articleSchema.safeParse(record.item);
    if (!parsed.success) return;
    const article = parsed.data;
    const id = paperIdFromUrl(article.url);
    if (!id || !isValidPaperId(id) || seen.has(id)) return;
    seen.add(id);
    const position = typeof record.position === "number" ? record.position : index + 1;
    candidates.push({
      id,
      rank: position,
      url: article.url,
      listing: {
        title: article.headline,
        summary: article.description ?? "",
        authors: (article.author ?? []).map((author) => author.name),
        views: interactionCount(article, "ViewAction"),
        likes: interactionCount(article, "LikeAction"),
        publishedAt: article.datePublished ?? null,
      },
    });
  });
  return candidates;
}
