import { Feed } from "@/components/Feed";
import { getFeedPage } from "@/lib/alphaxiv/feed";
import type { FeedPage } from "@/lib/alphaxiv/types";

// The feed is read from alphaXiv at request time (with an in-memory cache),
// so builds never depend on alphaXiv being reachable.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 4;

export default async function Home() {
  let initialPage: FeedPage | null = null;
  let initialError: string | null = null;
  try {
    initialPage = await getFeedPage(0, PAGE_SIZE);
  } catch (error) {
    initialError = error instanceof Error ? error.message : "Could not load the feed";
  }

  return <Feed initialPage={initialPage} initialError={initialError} pageSize={PAGE_SIZE} />;
}
