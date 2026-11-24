import { extractJsonLd, parseAttributes, stripTags } from "./html";
import { articleSchema, interactionCount, jsonLdNodes, type JsonLdPerson } from "./schema";
import type { Author, VideoExplainer } from "./types";

export type PaperPage = {
  title: string;
  abstract: string;
  authors: Author[];
  views: number | null;
  likes: number | null;
  comments: number | null;
  publishedAt: string | null;
  canonicalUrl: string;
  explainer: VideoExplainer | null;
};

const PROFILE_HOSTS = new Set(["www.alphaxiv.org", "alphaxiv.org"]);

function toAuthor(person: JsonLdPerson, baseUrl: string): Author {
  let profileUrl: string | null = null;
  if (person.url) {
    try {
      const url = new URL(person.url, baseUrl);
      // Only keep links that point at an alphaXiv researcher profile (/@slug).
      if (PROFILE_HOSTS.has(url.hostname) && url.pathname.startsWith("/@")) {
        profileUrl = `https://www.alphaxiv.org${url.pathname}`;
      }
    } catch {
      profileUrl = null;
    }
  }
  const affiliation =
    typeof person.affiliation === "string" ? person.affiliation : (person.affiliation?.name ?? null);
  return { name: person.name, profileUrl, affiliation: affiliation || null };
}

function absoluteHttps(value: string | undefined, baseUrl: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Finds the paper's "Video explainer" player and reads its sources. */
export function extractExplainer(html: string, baseUrl: string): VideoExplainer | null {
  const videoPattern = /<video\b[^>]*>[\s\S]*?<\/video>|<video\b[^>]*\/>/gi;
  for (const match of html.matchAll(videoPattern)) {
    const block = match[0];
    const openTag = block.match(/<video\b[^>]*>/i)?.[0] ?? block;
    const attributes = parseAttributes(openTag);
    if (!/video explainer/i.test(attributes["aria-label"] ?? "")) continue;

    const sourceTag = block.match(/<source\b[^>]*>/i)?.[0];
    const src = absoluteHttps(
      attributes.src ?? (sourceTag ? parseAttributes(sourceTag).src : undefined),
      baseUrl,
    );
    if (!src) continue;

    const trackTag = block.match(/<track\b[^>]*>/i)?.[0];
    const track = trackTag ? parseAttributes(trackTag) : {};
    return {
      src,
      poster: absoluteHttps(attributes.poster, baseUrl),
      captions: track.kind === "captions" || track.kind === "subtitles" || !track.kind
        ? absoluteHttps(track.src, baseUrl)
        : null,
    };
  }
  return null;
}

/** Reads a number rendered inside the element with the given aria-label. */
function countInLabelledElement(html: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<(a|button)\\b[^>]*aria-label="${escaped}"[^>]*>([\\s\\S]*?)</\\1>`,
    "i",
  );
  const inner = html.match(pattern)?.[2];
  if (!inner) return null;
  const text = stripTags(inner.replace(/<svg[\s\S]*?<\/svg>/gi, " "));
  const number = text.match(/^(\d[\d,]*)$/)?.[1];
  return number ? Number(number.replace(/,/g, "")) : null;
}

/** Parses an alphaXiv /abs/<id> page. Returns null if it has no article metadata. */
export function parsePaperPage(html: string, baseUrl: string): PaperPage | null {
  const nodes = extractJsonLd(html).flatMap(jsonLdNodes);
  const node = nodes.find(
    (candidate) => candidate["@type"] === "ScholarlyArticle" || candidate["@type"] === "Article",
  );
  const parsed = articleSchema.safeParse(node);
  if (!parsed.success) return null;
  const article = parsed.data;

  return {
    title: article.headline,
    abstract: article.abstract ?? article.description ?? "",
    authors: (article.author ?? []).map((person) => toAuthor(person, baseUrl)),
    views: interactionCount(article, "ViewAction"),
    likes: interactionCount(article, "LikeAction") ?? countInLabelledElement(html, "Like this paper"),
    comments: interactionCount(article, "CommentAction") ?? countInLabelledElement(html, "Comments"),
    publishedAt: article.datePublished ?? null,
    canonicalUrl: article.url,
    explainer: extractExplainer(html, baseUrl),
  };
}
