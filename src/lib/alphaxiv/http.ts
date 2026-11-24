import "server-only";

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly url: string,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

const USER_AGENT =
  "alphaxiv-doomscroll/0.1 (server-side feed reader)";

type FetchTextOptions = {
  timeoutMs?: number;
  retries?: number;
  revalidateSeconds?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GETs a URL as text with a timeout and retries on network errors, 429 and 5xx.
 * 404 is returned as null so callers can skip missing papers.
 */
export async function fetchText(
  url: string,
  { timeoutMs = 10_000, retries = 2, revalidateSeconds = 600 }: FetchTextOptions = {},
): Promise<string | null> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(timeoutMs),
        next: { revalidate: revalidateSeconds },
      });
      if (response.status === 404) return null;
      if (response.ok) return await response.text();
      const retryable = response.status === 429 || response.status >= 500;
      lastError = new UpstreamError(
        `alphaXiv responded ${response.status} for ${url}`,
        response.status,
        url,
      );
      if (!retryable) break;
    } catch (error) {
      lastError = error;
    }
    if (attempt < retries) await sleep(400 * 2 ** attempt);
  }
  if (lastError instanceof UpstreamError) throw lastError;
  throw new UpstreamError(
    `Could not reach ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    null,
    url,
  );
}

/** Runs async work over items with bounded concurrency, preserving order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index] as T, index);
    }
  });
  await Promise.all(runners);
  return results;
}
