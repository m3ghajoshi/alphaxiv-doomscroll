import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixture } from "./load-fixture";

const pages: Record<string, string | number> = {
  "https://www.alphaxiv.org/?sort=Hot": fixture("hot-page.html"),
  "https://www.alphaxiv.org/abs/2611.harness-cg": fixture("paper-without-video.html"),
  "https://www.alphaxiv.org/abs/2611.glm-5": 503,
  "https://www.alphaxiv.org/abs/2611.24778": fixture("paper-with-video.html"),
  "https://www.alphaxiv.org/abs/2611.claimed-riemann-hypothesis-proof": 404,
};

describe("getFeedPage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("ALPHAXIV_API_KEY", "");
    vi.stubEnv("FEED_SOURCE", "hot-page");
    vi.stubEnv("CACHE_TTL_SECONDS", "0");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const body = pages[String(input)];
        if (body === undefined) throw new Error(`unexpected fetch ${String(input)}`);
        if (typeof body === "number") return new Response("error", { status: body });
        return new Response(body, { status: 200 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps only Hot papers with a video explainer and skips failing papers", async () => {
    const { getFeedPage } = await import("@/lib/alphaxiv/feed");
    const page = await getFeedPage(0, 5);
    expect(page.source).toBe("hot-page");
    expect(page.scanned).toBe(4);
    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: "2611.24778",
      hotRank: 3,
      likes: 414,
      views: 7696,
      paperUrl: "https://www.alphaxiv.org/abs/2611.24778",
      discussionUrl: "https://www.alphaxiv.org/abs/2611.24778#discussion",
    });
    expect(page.items[0]?.summary).toContain("O(h^2) bound");
  });

  it("returns a cursor when it stops early", async () => {
    const { getFeedPage } = await import("@/lib/alphaxiv/feed");
    const page = await getFeedPage(0, 1);
    expect(page.items.map((item) => item.id)).toEqual(["2611.24778"]);
    expect(page.nextCursor).toBe(3);
    const rest = await getFeedPage(3, 1);
    expect(rest.items).toEqual([]);
    expect(rest.nextCursor).toBeNull();
  });
});
