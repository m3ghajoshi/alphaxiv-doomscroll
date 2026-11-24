"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FeedItem, FeedPage } from "@/lib/alphaxiv/types";
import { useActiveIndex } from "@/hooks/useActiveIndex";
import { Slide } from "./Slide";
import { VolumeOffIcon } from "./icons";

type Props = {
  initialPage: FeedPage | null;
  initialError: string | null;
  pageSize: number;
};

/** Slides within this distance of the active one mount their video; the rest are empty shells. */
const RENDER_WINDOW = 2;
/** Start fetching the next page when this close to the end. */
const PREFETCH_THRESHOLD = 2;

async function fetchPage(cursor: number, limit: number, signal?: AbortSignal): Promise<FeedPage> {
  const response = await fetch(`/api/feed?cursor=${cursor}&limit=${limit}`, { signal });
  const body = (await response.json().catch(() => null)) as (FeedPage & { error?: string }) | null;
  if (!response.ok || !body) {
    throw new Error(body?.error ?? `Feed request failed (${response.status})`);
  }
  return body;
}

export function Feed({ initialPage, initialError, pageSize }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { activeIndex, observe } = useActiveIndex(scrollerRef);

  const [items, setItems] = useState<FeedItem[]>(initialPage?.items ?? []);
  const [nextCursor, setNextCursor] = useState<number | null>(
    initialPage ? initialPage.nextCursor : 0,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [muted, setMuted] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const inFlight = useRef(false);

  const loadMore = useCallback(async () => {
    if (inFlight.current || nextCursor === null) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPage(nextCursor, pageSize);
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load more videos");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [nextCursor, pageSize]);

  // Load the first page client-side if the server render failed, and keep the
  // buffer topped up as the viewer approaches the end.
  useEffect(() => {
    if (error) return;
    if (items.length - activeIndex > PREFETCH_THRESHOLD || nextCursor === null) return;
    const timer = setTimeout(() => void loadMore(), 0);
    return () => clearTimeout(timer);
  }, [activeIndex, items.length, nextCursor, loadMore, error]);

  // Keyboard navigation for desktop.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const scroller = scrollerRef.current;
      if (!scroller || event.target instanceof HTMLInputElement) return;
      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        scroller.scrollBy({ top: scroller.clientHeight, behavior: "smooth" });
      } else if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        scroller.scrollBy({ top: -scroller.clientHeight, behavior: "smooth" });
      } else if (event.key === "m") {
        setMuted((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const toggleMute = useCallback(() => setMuted((value) => !value), []);
  const toggleCaptions = useCallback(() => setCaptionsOn((value) => !value), []);
  const autoplayBlocked = useCallback(() => setMuted(true), []);
  const notify = useCallback((message: string) => setToast(message), []);

  const exhausted = nextCursor === null && !loading;
  const showEndCard = items.length > 0 && exhausted;
  const isEmpty = items.length === 0 && exhausted && !error;

  const restart = useCallback(() => {
    scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const slides = useMemo(
    () =>
      items.map((item, index) => {
        const distance = Math.abs(index - activeIndex);
        return (
          <section
            key={item.id}
            ref={observe(index)}
            data-index={index}
            className="feed-slide relative w-full"
            aria-label={item.title}
            aria-roledescription="slide"
          >
            {distance <= RENDER_WINDOW ? (
              <Slide
                item={item}
                active={index === activeIndex}
                preload={distance === 1}
                muted={muted}
                captionsOn={captionsOn}
                onToggleMute={toggleMute}
                onToggleCaptions={toggleCaptions}
                onAutoplayBlocked={autoplayBlocked}
                onNotify={notify}
              />
            ) : null}
          </section>
        );
      }),
    [items, activeIndex, observe, muted, captionsOn, toggleMute, toggleCaptions, autoplayBlocked, notify],
  );

  return (
    <main className="relative mx-auto h-dvh w-full max-w-[calc(100dvh*9/16)] bg-black sm:border-x sm:border-white/10">
      <header className="safe-top pointer-events-none absolute inset-x-0 top-0 z-40 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-[15px] font-extrabold tracking-tight">
            alpha<span className="text-accent">X</span>iv <span className="font-medium text-white/70">Scroll</span>
          </h1>
        </div>
        {muted && items.length > 0 && (
          <button
            type="button"
            onClick={toggleMute}
            className="pointer-events-auto mx-auto flex w-fit items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-[12px] font-semibold backdrop-blur"
          >
            <VolumeOffIcon size={14} />
            Tap for sound
          </button>
        )}
      </header>

      <div ref={scrollerRef} className="feed-scroller" aria-live="polite">
        {slides}

        {loading && (
          <div className="feed-slide grid place-items-center">
            <div className="flex flex-col items-center gap-3 text-sm text-white/70">
              <span className="size-9 animate-spin rounded-full border-2 border-white/25 border-t-white" />
              Finding video explainers…
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="feed-slide grid place-items-center px-8 text-center">
            <div className="flex max-w-sm flex-col items-center gap-3">
              <p className="text-base font-semibold">Couldn&apos;t reach alphaXiv</p>
              <p className="text-sm text-white/65">{error}</p>
              <button
                type="button"
                onClick={() => void loadMore()}
                className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {isEmpty && (
          <div className="feed-slide grid place-items-center px-8 text-center">
            <div className="flex max-w-sm flex-col gap-2">
              <p className="text-base font-semibold">No video explainers right now</p>
              <p className="text-sm text-white/65">
                None of the papers on alphaXiv&apos;s lists have a video explainer right now.
                Check back soon.
              </p>
            </div>
          </div>
        )}

        {showEndCard && (
          <div className="feed-slide grid place-items-center px-8 text-center">
            <div className="flex max-w-sm flex-col items-center gap-3">
              <p className="text-lg font-bold">You&apos;re all caught up</p>
              <p className="text-sm text-white/65">
                That&apos;s every alphaXiv video explainer we could find right now.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={restart}
                  className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
                >
                  Watch again
                </button>
                <a
                  href="https://www.alphaxiv.org/?sort=Hot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/30 px-5 py-2 text-sm font-semibold"
                >
                  Browse alphaXiv
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div
          role="status"
          className="absolute top-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black shadow-lg"
        >
          {toast}
        </div>
      )}
    </main>
  );
}
