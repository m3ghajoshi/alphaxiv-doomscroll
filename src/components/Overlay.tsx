"use client";

import { useState } from "react";
import { formatCount } from "@/lib/format";
import type { FeedItem } from "@/lib/alphaxiv/types";
import { ExpandableText } from "./ExpandableText";
import { EyeIcon, SparkIcon } from "./icons";

const VISIBLE_AUTHORS = 3;

/** Bottom-left caption: rank, title, author tags, explainer badge and summary. */
export function Overlay({ item }: { item: FeedItem }) {
  const [showAllAuthors, setShowAllAuthors] = useState(false);
  const authors = showAllAuthors ? item.authors : item.authors.slice(0, VISIBLE_AUTHORS);
  const hiddenAuthors = item.authors.length - VISIBLE_AUTHORS;

  return (
    <div className="pointer-events-auto flex flex-col gap-2 pr-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
        <span className="rounded-full bg-white/15 px-2 py-0.5 backdrop-blur">
          {item.collection.sort === "Hot"
            ? `#${item.rank} on Hot`
            : `#${item.rank} · ${item.collection.label}`}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-accent/90 px-2 py-0.5 text-white">
          <SparkIcon size={11} />
          alphaXiv Video Explainer
        </span>
        {item.views !== null && (
          <span className="inline-flex items-center gap-1 text-white/75">
            <EyeIcon size={12} />
            {formatCount(item.views)} views
          </span>
        )}
      </div>

      <h2 className="text-[17px] leading-tight font-bold text-balance drop-shadow">
        <a href={item.paperUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {item.title}
        </a>
      </h2>

      {item.authors.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Authors">
          {authors.map((author, index) => (
            <li key={`${author.name}-${index}`}>
              {author.profileUrl ? (
                <a
                  href={author.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={author.affiliation ?? undefined}
                  className="block rounded-full bg-black/35 px-2 py-0.5 text-[12px] font-semibold text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20"
                >
                  @{author.name}
                </a>
              ) : (
                <span
                  title={author.affiliation ?? undefined}
                  className="block rounded-full bg-black/25 px-2 py-0.5 text-[12px] text-white/80 ring-1 ring-white/10"
                >
                  {author.name}
                </span>
              )}
            </li>
          ))}
          {hiddenAuthors > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setShowAllAuthors((value) => !value)}
                className="rounded-full px-2 py-0.5 text-[12px] font-semibold text-white/80 hover:text-white"
              >
                {showAllAuthors ? "show less" : `+${hiddenAuthors} more`}
              </button>
            </li>
          )}
        </ul>
      )}

      <ExpandableText text={item.summary} lines={2} />
    </div>
  );
}
