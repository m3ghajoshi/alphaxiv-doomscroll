"use client";

import { useLayoutEffect, useRef, useState } from "react";

type Props = { text: string; lines?: number; className?: string };

/** Clamps text to N lines with a "more"/"less" toggle that only appears when needed. */
export function ExpandableText({ text, lines = 2, className = "" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || expanded) return;
    const measure = () => setOverflowing(element.scrollHeight - element.clientHeight > 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded]);

  if (!text) return null;

  return (
    <div className={className}>
      <p
        ref={ref}
        className={`text-[13px] leading-snug text-white/90 ${
          expanded ? "max-h-[32dvh] overflow-y-auto overscroll-contain pr-1" : ""
        }`}
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitLineClamp: lines,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
        }
      >
        {text}
      </p>
      {(overflowing || expanded) && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
          className="mt-0.5 text-[13px] font-semibold text-white"
          aria-expanded={expanded}
        >
          {expanded ? "less" : "more"}
        </button>
      )}
    </div>
  );
}
