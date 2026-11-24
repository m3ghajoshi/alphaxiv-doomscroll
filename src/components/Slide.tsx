"use client";

import { memo } from "react";
import type { FeedItem } from "@/lib/alphaxiv/types";
import { ActionBar } from "./ActionBar";
import { Overlay } from "./Overlay";
import { VideoStage } from "./VideoStage";

type Props = {
  item: FeedItem;
  active: boolean;
  preload: boolean;
  muted: boolean;
  captionsOn: boolean;
  onToggleMute: () => void;
  onToggleCaptions: () => void;
  onAutoplayBlocked: () => void;
  onNotify: (message: string) => void;
};

/** One full-screen feed entry: video stage plus TikTok-style overlays. */
export const Slide = memo(function Slide({
  item,
  active,
  preload,
  muted,
  captionsOn,
  onToggleMute,
  onToggleCaptions,
  onAutoplayBlocked,
  onNotify,
}: Props) {
  return (
    <>
      <VideoStage
        explainer={item.explainer}
        title={item.title}
        paperUrl={item.paperUrl}
        active={active}
        preload={preload}
        muted={muted}
        captionsOn={captionsOn}
        onToggleMute={onToggleMute}
        onAutoplayBlocked={onAutoplayBlocked}
      />

      {/* Legibility gradient behind the overlays. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[55%] bg-gradient-to-t from-black/90 via-black/45 to-transparent"
      />

      <div className="safe-bottom pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end gap-3 px-3 pb-5">
        <div className="min-w-0 flex-1">
          <Overlay item={item} />
        </div>
        <div className="shrink-0 pb-1">
          <ActionBar
            item={item}
            captionsOn={captionsOn}
            onToggleCaptions={onToggleCaptions}
            onNotify={onNotify}
          />
        </div>
      </div>
    </>
  );
});
