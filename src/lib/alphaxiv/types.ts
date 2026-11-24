/** An author with an optional alphaXiv profile link. */
export type Author = {
  name: string;
  profileUrl: string | null;
  affiliation: string | null;
};

export type VideoExplainer = {
  /** 16:9 mp4 hosted on alphaXiv's explainer CDN. */
  src: string;
  poster: string | null;
  captions: string | null;
};

export type FeedItem = {
  id: string;
  title: string;
  summary: string;
  authors: Author[];
  views: number | null;
  likes: number | null;
  comments: number | null;
  publishedAt: string | null;
  paperUrl: string;
  discussionUrl: string;
  /** 1-based rank in the Hot feed. */
  hotRank: number;
  explainer: VideoExplainer;
};

export type FeedPage = {
  items: FeedItem[];
  /** Pass back as ?cursor= to load the next page; null when the feed is exhausted. */
  nextCursor: number | null;
  /** Total Hot papers being scanned. */
  scanned: number;
  source: "mcp" | "hot-page";
};

/** A paper from the Hot feed, before its paper page has been read. */
export type HotCandidate = {
  id: string;
  rank: number;
  url: string;
  /** Data from the Hot page listing, when that was the source. */
  listing?: {
    title: string;
    summary: string;
    authors: string[];
    views: number | null;
    likes: number | null;
    publishedAt: string | null;
  };
};
