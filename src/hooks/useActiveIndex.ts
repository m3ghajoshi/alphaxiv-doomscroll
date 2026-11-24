"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks which snap slide is mostly in view inside a scroll container.
 * Slides register with `observe(index)` as a ref callback.
 */
export function useActiveIndex(root: React.RefObject<HTMLElement | null>) {
  const [activeIndex, setActiveIndex] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const nodes = useRef(new Map<number, Element>());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            if (Number.isInteger(index)) setActiveIndex(index);
          }
        }
      },
      { root: root.current, threshold: [0.6] },
    );
    observerRef.current = observer;
    nodes.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [root]);

  const observe = useCallback(
    (index: number) => (node: HTMLElement | null) => {
      const previous = nodes.current.get(index);
      if (previous && previous !== node) observerRef.current?.unobserve(previous);
      if (node) {
        nodes.current.set(index, node);
        observerRef.current?.observe(node);
      } else {
        nodes.current.delete(index);
      }
    },
    [],
  );

  return { activeIndex, observe };
}
