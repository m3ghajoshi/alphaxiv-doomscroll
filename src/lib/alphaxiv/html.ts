const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decodes the HTML entities that appear in server-rendered attribute values. */
export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1]?.toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Parses the attributes of a single opening tag into a lowercase-keyed map. */
export function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s=<>"'/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  const inner = tag.replace(/^<\s*[\w-]+/, "").replace(/\/?>$/, "");
  for (const match of inner.matchAll(pattern)) {
    const name = match[1];
    if (!name) continue;
    attributes[name.toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

/** Returns the parsed contents of every <script type="application/ld+json"> block. */
export function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const body = match[1];
    if (!body) continue;
    try {
      blocks.push(JSON.parse(body));
    } catch {
      // A malformed block should not take down the rest of the page.
    }
  }
  return blocks;
}

/** Removes tags and collapses whitespace. */
export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}
