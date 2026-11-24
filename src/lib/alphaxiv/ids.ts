/** Extracts the alphaXiv paper id from an /abs/<id> or /overview/<id> URL. */
export function paperIdFromUrl(url: string): string | null {
  try {
    const { pathname } = new URL(url, "https://www.alphaxiv.org");
    const match = pathname.match(/^\/(?:abs|overview|resources)\/([^/?#]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/** Allows arXiv-style ids (2611.24778, 2611.24778v2) and alphaXiv slugs (2611.glm-5). */
export function isValidPaperId(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{2,120}$/.test(id);
}
