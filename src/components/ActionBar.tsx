"use client";

import { useCallback, useState } from "react";
import { formatCount } from "@/lib/format";
import type { FeedItem } from "@/lib/alphaxiv/types";
import { CaptionsIcon, CommentIcon, PaperIcon, ShareIcon, UpvoteIcon } from "./icons";

type Props = {
  item: FeedItem;
  captionsOn: boolean;
  onToggleCaptions: () => void;
  onNotify: (message: string) => void;
};

const buttonClass =
  "flex flex-col items-center gap-1 text-[11px] font-semibold text-white drop-shadow focus-visible:outline-2 focus-visible:outline-white rounded-xl";
const bubbleClass =
  "grid size-10 place-items-center rounded-full bg-black/35 ring-1 ring-white/15 backdrop-blur transition active:scale-90";

/** Right-hand action column: upvotes, discussion, share, captions, read paper. */
export function ActionBar({ item, captionsOn, onToggleCaptions, onNotify }: Props) {
  const [sharing, setSharing] = useState(false);

  const share = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    const data = { title: item.title, text: `${item.title} — video explainer on alphaXiv`, url: item.paperUrl };
    try {
      if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(data))) {
        await navigator.share(data);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.paperUrl);
        onNotify("Link copied");
      } else {
        window.prompt("Copy this link", item.paperUrl);
      }
    } catch (error) {
      // AbortError means the person closed the share sheet: not a failure.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        onNotify("Could not share this paper");
      }
    } finally {
      setSharing(false);
    }
  }, [item.paperUrl, item.title, onNotify, sharing]);

  return (
    <nav className="pointer-events-auto flex flex-col items-center gap-3" aria-label="Paper actions">
      <a
        href={item.paperUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass}
        aria-label={`Upvote on alphaXiv${item.likes !== null ? ` (${item.likes} upvotes)` : ""}`}
      >
        <span className={bubbleClass}>
          <UpvoteIcon size={22} />
        </span>
        {item.likes !== null ? formatCount(item.likes) : "Upvote"}
      </a>

      <a
        href={item.discussionUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass}
        aria-label={`Open discussion${item.comments !== null ? ` (${item.comments} comments)` : ""}`}
      >
        <span className={bubbleClass}>
          <CommentIcon size={20} />
        </span>
        {item.comments !== null ? formatCount(item.comments) : "Discuss"}
      </a>

      <button type="button" onClick={share} className={buttonClass} aria-label="Share paper">
        <span className={bubbleClass}>
          <ShareIcon size={20} />
        </span>
        Share
      </button>

      {item.explainer.captions && (
        <button
          type="button"
          onClick={onToggleCaptions}
          className={buttonClass}
          aria-pressed={captionsOn}
          aria-label={captionsOn ? "Hide captions" : "Show captions"}
        >
          <span className={`${bubbleClass} ${captionsOn ? "bg-white text-black" : ""}`}>
            <CaptionsIcon size={20} />
          </span>
          CC
        </button>
      )}

      <a
        href={item.paperUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass}
        aria-label="Read paper on alphaXiv"
      >
        <span className="grid size-10 place-items-center rounded-full bg-accent ring-1 ring-white/30 transition active:scale-90">
          <PaperIcon size={20} />
        </span>
        Read
      </a>
    </nav>
  );
}
