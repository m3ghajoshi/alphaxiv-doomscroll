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
  /** Which alphaXiv list the paper came from, and its 1-based position there. */
  collection: Collection;
  rank: number;
  explainer: VideoExplainer;
};

/** An alphaXiv feed list: a sort plus a time interval, e.g. Hot over 30 days. */
export type Collection = {
  sort: string;
  interval: string;
  /** Short label for the UI, e.g. "Hot" or "Most liked". */
  label: string;
};

export type FeedPage = {
  items: FeedItem[];
  /** Pass back as ?cursor= to load the next page; null when the feed is exhausted. */
  nextCursor: number | null;
  /** Total papers scanned across all lists. */
  scanned: number;
  /** Total explainers found. */
  total: number;
  source: "feed-api" | "mcp";
};

/** A paper ID from the MCP Hot feed, before its paper page has been read. */
export type HotCandidate = {
  id: string;
  rank: number;
  url: string;
};
