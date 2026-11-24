/**
 * Some mobile browsers (iPhone Low Power Mode, apps' built-in browsers) only
 * let a <video> play after it has been started during a tap. To keep the feed
 * autoplaying there, every tap briefly starts each mounted video that hasn't
 * been unlocked yet (muted) and pauses it again unless it is the active one.
 * One window listener is shared by all slides.
 */
const unlocked = new WeakSet<HTMLVideoElement>();
let subscribers = 0;
let detach: (() => void) | null = null;

function primeAll() {
  document.querySelectorAll("video").forEach((video) => {
    // The active slide starts its own video on the same gesture.
    if (video.dataset.active === "true") return;
    if (unlocked.has(video) || !video.paused) {
      unlocked.add(video);
      return;
    }
    const wasMuted = video.muted;
    video.muted = true;
    let attempt: Promise<void>;
    try {
      attempt = video.play();
    } catch {
      return;
    }
    attempt.then(
      () => {
        unlocked.add(video);
        // The blurred backdrop copy stays muted and is kept in sync by its slide.
        if (video.getAttribute("aria-hidden") === "true") return;
        // It may have become the active slide's video meanwhile: leave it playing.
        if (video.dataset.active === "true") {
          video.muted = wasMuted;
          return;
        }
        video.pause();
        video.currentTime = 0;
        video.muted = wasMuted;
      },
      () => {
        video.muted = wasMuted;
      },
    );
  });
}

export function primeVideosOnGesture(events: readonly string[]): () => void {
  subscribers += 1;
  if (!detach) {
    events.forEach((name) => window.addEventListener(name, primeAll, { capture: true, passive: true }));
    detach = () =>
      events.forEach((name) => window.removeEventListener(name, primeAll, { capture: true }));
  }
  return () => {
    subscribers -= 1;
    if (subscribers === 0 && detach) {
      detach();
      detach = null;
    }
  };
}
