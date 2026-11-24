import { describe, expect, it } from "vitest";
import { hotFeedToCandidates, readToolPayload } from "@/lib/alphaxiv/mcp";

describe("alphaXiv MCP get_hot_feed handling", () => {
  it("reads JSON from a text content block", () => {
    const payload = readToolPayload({
      content: [{ type: "text", text: '{"papers":[{"universal_paper_id":"2307.12307"}]}' }],
    });
    expect(payload).toEqual({ papers: [{ universal_paper_id: "2307.12307" }] });
  });

  it("prefers structuredContent and surfaces tool errors", () => {
    expect(readToolPayload({ structuredContent: { papers: [] }, content: [] })).toEqual({ papers: [] });
    expect(() =>
      readToolPayload({ isError: true, content: [{ type: "text", text: "Invalid API key" }] }),
    ).toThrow(/Invalid API key/);
  });

  it("maps paper ids to ranked candidates, dropping duplicates and unsafe ids", () => {
    const candidates = hotFeedToCandidates(
      {
        papers: [
          { universal_paper_id: "2611.24778" },
          { universal_paper_id: "2611.24778" },
          { universal_paper_id: "../../etc/passwd" },
          { universal_paper_id: "2611.glm-5" },
        ],
      },
      "https://www.alphaxiv.org",
    );
    expect(candidates).toEqual([
      { id: "2611.24778", rank: 1, url: "https://www.alphaxiv.org/abs/2611.24778" },
      { id: "2611.glm-5", rank: 2, url: "https://www.alphaxiv.org/abs/2611.glm-5" },
    ]);
  });

  it("rejects unexpected shapes", () => {
    expect(() => hotFeedToCandidates({ items: [] }, "https://www.alphaxiv.org")).toThrow();
  });
});
