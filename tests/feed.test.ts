import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixture } from "./load-fixture";

const API = "https://api.alphaxiv.org/papers/v3/feed";

function respond(url: URL): Response {
  const sort = url.searchParams.get("sort");
  const page = url.searchParams.get("pageNum");
  if (sort === "Hot" && page === "0") return new Response(fixture("feed-hot-page0.json"));
  if (sort === "Likes" && page === "0") return new Response(fixture("feed-likes-page0.json"));
  return new Response(JSON.stringify({ papers: [] }));
}

describe("getFeedPage (feed API)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("ALPHAXIV_API_KEY", "");
    vi.stubEnv("FEED_SOURCE", "auto");
    vi.stubEnv("FEED_LISTS", "Hot:30 Days,Likes:All time");
    vi.stubEnv("FEED_PAGE_SIZE", "50");
    vi.stubEnv("FEED_MAX_PAGES", "2");
    vi.stubEnv("CACHE_TTL_SECONDS", "60");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("merges Hot then Likes, keeps only explainers, and de-duplicates", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      expect(`${url.origin}${url.pathname}`).toBe(API);
      return respond(url);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getFeedPage } = await import("@/lib/alphaxiv/feed");

    const page = await getFeedPage(0, 2);
    expect(page.source).toBe("feed-api");
    expect(page.total).toBe(3);
    expect(page.items.map((item) => [item.id, item.collection.sort, item.rank])).toEqual([
      ["2611.24778", "Hot", 2],
      ["2611.glm-5", "Hot", 3],
    ]);
    expect(page.nextCursor).toBe(2);

    const rest = await getFeedPage(2, 2);
    expect(rest.items.map((item) => [item.id, item.collection.label, item.rank])).toEqual([
      ["2611.23001", "Most liked", 2],
    ]);
    expect(rest.nextCursor).toBeNull();
    // Two pages per list, fetched once and then served from the cache.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("keeps the feed when one list fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        if (url.searchParams.get("sort") === "Likes") return new Response("nope", { status: 400 });
        return respond(url);
      }),
    );
    const { getFeedPage } = await import("@/lib/alphaxiv/feed");
    const page = await getFeedPage(0, 10);
    expect(page.items.map((item) => item.id)).toEqual(["2611.24778", "2611.glm-5"]);
  });

  it("errors clearly when the response format is unrecognised", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "moved" }))));
    const { getFeedPage } = await import("@/lib/alphaxiv/feed");
    await expect(getFeedPage(0, 5)).rejects.toThrow(/no paper list/);
  });
});
