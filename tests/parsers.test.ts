import { describe, expect, it } from "vitest";
import { decodeEntities, parseAttributes } from "@/lib/alphaxiv/html";
import { paperIdFromUrl } from "@/lib/alphaxiv/ids";
import { extractExplainer, parsePaperPage } from "@/lib/alphaxiv/paper-page";
import { formatCount, toPlainText } from "@/lib/format";
import { fixture } from "./load-fixture";

const BASE = "https://www.alphaxiv.org";

describe("parsePaperPage", () => {
  it("extracts metadata, profile links and the video explainer", () => {
    const page = parsePaperPage(fixture("paper-with-video.html"), BASE);
    expect(page).not.toBeNull();
    expect(page?.title).toBe('Counterfactual World Models: JEPAs That Reason About "What If"');
    expect(page?.views).toBe(7696);
    expect(page?.likes).toBe(414);
    expect(page?.comments).toBeNull();
    expect(page?.authors).toEqual([
      { name: "Randall Balestriero", profileUrl: "https://www.alphaxiv.org/@randall-balestriero", affiliation: "AI Researcher" },
      { name: "Yann LeCun", profileUrl: "https://www.alphaxiv.org/@yann-lecun", affiliation: "New York University" },
      { name: "Kerda Varaku", profileUrl: null, affiliation: null },
    ]);
    const hash = "57d63d7eeaf715a27195b3d7c681c025bda4aa5fb41f9ae93017dda935a0d9d7";
    expect(page?.explainer).toEqual({
      src: `https://explainers.assets.alphaxiv.org/${hash}.mp4`,
      poster: `https://explainers.assets.alphaxiv.org/${hash}.jpg`,
      captions: `https://explainers.assets.alphaxiv.org/${hash}.vtt`,
    });
  });

  it("ignores other videos on the page (blog clips) and returns null without an explainer", () => {
    const page = parsePaperPage(fixture("paper-without-video.html"), BASE);
    expect(page?.explainer).toBeNull();
    expect(page?.canonicalUrl).toBe("https://www.alphaxiv.org/abs/2611.28298");
    expect(page?.likes).toBeNull();
    expect(
      extractExplainer('<video src="https://example.com/a.mp4"></video>', BASE),
    ).toBeNull();
  });

  it("falls back to the like button count when JSON-LD has no stats", () => {
    const html = fixture("paper-without-video.html").replace(
      'aria-label="Like this paper" data-state="closed">',
      'aria-label="Like this paper" data-state="closed"><span>1,203</span>',
    );
    expect(parsePaperPage(html, BASE)?.likes).toBe(1203);
  });

  it("rejects profile links that are not alphaXiv researcher pages", () => {
    const html = fixture("paper-with-video.html").replace(
      "https://www.alphaxiv.org/@yann-lecun",
      "https://evil.example/@yann-lecun",
    );
    expect(parsePaperPage(html, BASE)?.authors[1]?.profileUrl).toBeNull();
  });

  it("returns null for pages without article metadata", () => {
    expect(parsePaperPage("<html></html>", BASE)).toBeNull();
  });
});

describe("helpers", () => {
  it("parses attributes and entities", () => {
    expect(parseAttributes('<video a="1&amp;2" b=\'x\' c=plain d>')).toEqual({ a: "1&2", b: "x", c: "plain", d: "" });
    expect(decodeEntities("&quot;Hi&quot; &#39;you&#x27;")).toBe("\"Hi\" 'you'");
  });

  it("extracts paper ids from URLs", () => {
    expect(paperIdFromUrl("https://www.alphaxiv.org/abs/2611.glm-5")).toBe("2611.glm-5");
    expect(paperIdFromUrl("/overview/2507.01006v6")).toBe("2507.01006v6");
    expect(paperIdFromUrl("https://www.alphaxiv.org/@someone")).toBeNull();
  });

  it("formats counts and strips LaTeX delimiters", () => {
    expect(formatCount(20692)).toBe("20.7K");
    expect(formatCount(null)).toBe("");
    expect(toPlainText("an $O(h^2)$ bound,  100\\% sure")).toBe("an O(h^2) bound, 100% sure");
  });
});
