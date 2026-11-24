import { describe, expect, it } from "vitest";
import {
  buildFeedUrl,
  extractPaperArray,
  feedPaperToItem,
  parseFeedResponse,
} from "@/lib/alphaxiv/feed-api";
import { parseLists } from "@/lib/config";
import { fixture } from "./load-fixture";

const HOT = { sort: "Hot", interval: "30 Days", label: "Hot" };
const BASE = "https://www.alphaxiv.org";

describe("feed API parsing", () => {
  it("builds the feed URL the way alphaXiv's client does", () => {
    expect(buildFeedUrl("https://api.alphaxiv.org", HOT, 0, 50)).toBe(
      "https://api.alphaxiv.org/papers/v3/feed?pageNum=0&sort=Hot&pageSize=50&interval=30+Days&topics=%5B%5D&linkBlogs=true",
    );
  });

  it("finds the paper list under common wrappers", () => {
    const paper = { universal_paper_id: "x", title: "t" };
    expect(extractPaperArray([paper])).toEqual([paper]);
    expect(extractPaperArray({ papers: [paper] })).toEqual([paper]);
    expect(extractPaperArray({ data: { papers: [paper] } })).toEqual([paper]);
    expect(extractPaperArray({ whatever: [paper], page: 1 })).toEqual([paper]);
    expect(extractPaperArray({ message: "nope" })).toBeNull();
  });

  it("skips malformed papers instead of failing", () => {
    const papers = parseFeedResponse(JSON.parse(fixture("feed-likes-page0.json")));
    expect(papers?.map((p) => p.universal_paper_id)).toEqual(["2611.24778", "2611.23001"]);
  });

  it("maps a paper with an explainer to a feed item", () => {
    const [, paper] = parseFeedResponse(JSON.parse(fixture("feed-hot-page0.json"))) ?? [];
    const item = feedPaperToItem(paper!, HOT, 2, BASE);
    const hash = "57d63d7eeaf715a27195b3d7c681c025bda4aa5fb41f9ae93017dda935a0d9d7";
    expect(item).toMatchObject({
      id: "2611.24778",
      rank: 2,
      likes: 414,
      views: 7696,
      comments: null,
      summary: "Summary of Counterfactual World Models: JEPAs That Reason About \"What If\".",
      paperUrl: "https://www.alphaxiv.org/abs/2611.24778",
      discussionUrl: "https://www.alphaxiv.org/abs/2611.24778#discussion",
      explainer: {
        src: `https://explainers.assets.alphaxiv.org/${hash}.mp4`,
        poster: `https://explainers.assets.alphaxiv.org/${hash}.jpg`,
        captions: `https://explainers.assets.alphaxiv.org/${hash}.vtt`,
      },
    });
    expect(item?.authors).toEqual([
      { name: "Randall Balestriero", profileUrl: "https://www.alphaxiv.org/@randall-balestriero", affiliation: "Brown University" },
      { name: "Yann LeCun", profileUrl: "https://www.alphaxiv.org/@yann-lecun", affiliation: "NYU" },
      { name: "Kerda Varaku", profileUrl: null, affiliation: null },
    ]);
  });

  it("returns null for papers without an explainer and rejects unsafe slugs", () => {
    const [first, second] = parseFeedResponse(JSON.parse(fixture("feed-hot-page0.json"))) ?? [];
    expect(feedPaperToItem(first!, HOT, 1, BASE)).toBeNull();
    const tampered = {
      ...second!,
      full_authors_v2: [{ full_name: "X", researcher: { slug: "../../evil?x=1" } }],
    };
    expect(feedPaperToItem(tampered, HOT, 1, BASE)?.authors[0]?.profileUrl).toBeNull();
  });
});

describe("parseLists", () => {
  it("parses sort:interval pairs with labels", () => {
    expect(parseLists("Hot:30 Days, Likes:All time")).toEqual([
      { sort: "Hot", interval: "30 Days", label: "Hot" },
      { sort: "Likes", interval: "All time", label: "Most liked" },
    ]);
  });

  it("rejects unknown sorts and intervals", () => {
    expect(() => parseLists("Trending:30 Days")).toThrow(/unknown sort/);
    expect(() => parseLists("Hot:Forever")).toThrow(/unknown interval/);
  });
});
