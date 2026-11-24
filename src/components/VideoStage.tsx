"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoExplainer } from "@/lib/alphaxiv/types";
import { PauseIcon, PlayIcon, RotateIcon, VolumeOffIcon, VolumeOnIcon } from "./icons";

type Props = {
  explainer: VideoExplainer;
  title: string;
  paperUrl: string;
  /** The slide is the one snapped into view: play it. */
  active: boolean;
  /** The slide is adjacent to the active one: start buffering. */
  preload: boolean;
  muted: boolean;
  captionsOn: boolean;
  /** Sideways mode: the video is centered and as large as the frame allows. */
  landscape: boolean;
  onToggleMute: () => void;
  onToggleLandscape: () => void;
  /** Called when the browser refuses to autoplay with sound. */
  onAutoplayBlocked: () => void;
};

const DRIFT_TOLERANCE_S = 0.25;
/** How long a press must last before it counts as a hold (2x speed) rather than a tap. */
const HOLD_DELAY_MS = 280;
const FAST_RATE = 2;


function setCaptionMode(video: HTMLVideoElement | null, mode: TextTrackMode) {
  const track = video?.textTracks[0];
  if (track) track.mode = mode;
}

/**
 * Presents a 16:9 explainer in a 9:16 viewport: a blurred, zoomed copy fills
 * the frame behind the centered player, so nothing is cropped. The background
 * copy only decodes while the slide is active.
 */
export function VideoStage({
  explainer,
  title,
  paperUrl,
  active,
  preload,
  muted,
  captionsOn,
  landscape,
  onToggleMute,
  onToggleLandscape,
  onAutoplayBlocked,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const backdropRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [fast, setFast] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holding = useRef(false);
  const userPaused = useRef(false);
  const activeRef = useRef(active);
  const mutedRef = useRef(muted);

  useEffect(() => {
    activeRef.current = active;
    mutedRef.current = muted;
  });

  /**
   * Starts playback of the active slide. Browsers allow muted autoplay; if sound
   * is on and the browser refuses, fall back to muted. If even muted playback is
   * refused (e.g. iOS Low Power Mode), show the play button.
   */
  const startPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video || !activeRef.current || !video.paused || userPaused.current) return;
    video.muted = mutedRef.current;
    video.play().then(
      () => setPaused(false),
      (error: unknown) => {
        if (!(error instanceof DOMException)) return setPaused(true);
        if (error.name === "AbortError") return; // interrupted by a load; onCanPlay retries
        if (error.name === "NotAllowedError" && !video.muted) {
          onAutoplayBlocked();
          video.muted = true;
          video.play().then(
            () => setPaused(false),
            () => setPaused(true),
          );
          return;
        }
        setPaused(true);
      },
    );
  }, [onAutoplayBlocked]);

  // Play when active (including the first slide on page load); pause and rewind when scrolled away.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      startPlayback();
      return;
    }
    userPaused.current = false;
    video.pause();
    video.playbackRate = 1;
    if (video.currentTime > 0) video.currentTime = 0;
  }, [active, startPlayback]);

  // If the browser refused to autoplay, start on the first touch, click or key press anywhere.
  useEffect(() => {
    if (!active || !paused || userPaused.current) return;
    const start = () => startPlayback();
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((name) => window.addEventListener(name, start, { once: true, passive: true }));
    return () => events.forEach((name) => window.removeEventListener(name, start));
  }, [active, paused, startPlayback]);

  // The muted *attribute* (not just the property) is what some mobile browsers
  // check before allowing autoplay, and React doesn't render it.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.defaultMuted = true;
    video.setAttribute("muted", "");
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = muted;
  }, [muted]);

  // Show or hide the captions track.
  useEffect(() => {
    setCaptionMode(videoRef.current, captionsOn && active ? "showing" : "hidden");
  }, [captionsOn, active]);

  // Progress bar and backdrop sync, driven by rAF to avoid React re-renders.
  useEffect(() => {
    if (!active) {
      if (progressRef.current) progressRef.current.style.transform = "scaleX(0)";
      return;
    }
    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      const backdrop = backdropRef.current;
      if (video && progressRef.current && video.duration > 0) {
        progressRef.current.style.transform = `scaleX(${video.currentTime / video.duration})`;
      }
      if (video && backdrop && backdrop.readyState >= 2) {
        if (Math.abs(backdrop.currentTime - video.currentTime) > DRIFT_TOLERANCE_S) {
          backdrop.currentTime = video.currentTime;
        }
        if (backdrop.playbackRate !== video.playbackRate) {
          backdrop.playbackRate = video.playbackRate;
        }
        if (video.paused !== backdrop.paused) {
          if (video.paused) backdrop.pause();
          else backdrop.play().catch(() => undefined);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  const setRate = useCallback((rate: number) => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
    if (backdropRef.current) backdropRef.current.playbackRate = rate;
    setFast(rate !== 1);
  }, []);

  const clearHold = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    if (holding.current) setRate(1);
  }, [setRate]);

  // Press and hold anywhere on the video for 2x speed; release to go back to 1x.
  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      holding.current = false;
      if (holdTimer.current) clearTimeout(holdTimer.current);
      holdTimer.current = setTimeout(() => {
        const video = videoRef.current;
        if (!video || video.paused) return;
        holding.current = true;
        setRate(FAST_RATE);
      }, HOLD_DELAY_MS);
    },
    [setRate],
  );

  useEffect(() => () => clearHold(), [clearHold]);

  const handleTap = useCallback(() => {
    // A hold just ended: it was a speed-up, not a tap.
    if (holding.current) {
      holding.current = false;
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPaused.current = false;
      video.play().then(
        () => setPaused(false),
        () => setPaused(true),
      );
      return;
    }
    onToggleMute();
    setPulse((value) => value + 1);
  }, [onToggleMute]);

  const togglePause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPaused.current = false;
      video.play().then(
        () => setPaused(false),
        () => setPaused(true),
      );
    } else {
      userPaused.current = true;
      video.pause();
      setPaused(true);
    }
  }, []);

  const seek = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !(video.duration > 0)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
  }, []);

  const backdropImage = explainer.poster ? `url("${explainer.poster}")` : undefined;
  // Where the 16:9 frame sits: nudged up in portrait (room for the caption), centered sideways.
  const frameTop = landscape ? "top-1/2" : "top-[30%]";
  const frameStyle = {
    width: landscape ? "min(100%, calc(var(--feed-h) * 16 / 9))" : "100%",
  };

  return (
    <div className="absolute inset-0 isolate overflow-hidden bg-neutral-950">
      {/* Blurred, zoomed backdrop: poster image always, live video copy when active. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 scale-[1.6] bg-cover bg-center opacity-70 blur-2xl"
        style={{ backgroundImage: backdropImage }}
      />
      {active && (
        <video
          ref={backdropRef}
          aria-hidden="true"
          tabIndex={-1}
          className="absolute inset-0 h-full w-full scale-[1.6] object-cover opacity-70 blur-2xl"
          src={explainer.src}
          muted
          playsInline
          loop
          preload="auto"
          disablePictureInPicture
        />
      )}
      <div aria-hidden="true" className="absolute inset-0 bg-black/30" />

      {/* Tap target covering the frame: tap toggles sound (or resumes if paused). */}
      <button
        type="button"
        onClick={handleTap}
        onPointerDown={handlePointerDown}
        onPointerUp={clearHold}
        onPointerCancel={clearHold}
        onPointerLeave={clearHold}
        onContextMenu={(event) => event.preventDefault()}
        style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
        className="absolute inset-0 z-10 cursor-pointer"
        aria-label={paused ? `Play explainer for ${title}` : muted ? "Unmute" : "Mute"}
      />

      {/* Centered 16:9 player, nudged up so the caption overlay doesn't cover it. */}
      <div className={`pointer-events-none absolute inset-x-0 ${frameTop} z-0 -translate-y-1/2`}>
        <div
          className="relative mx-auto aspect-video overflow-hidden shadow-2xl shadow-black/60 sm:rounded-lg"
          style={frameStyle}
        >
          <video
            ref={videoRef}
            className="h-full w-full bg-black object-contain"
            src={explainer.src}
            poster={explainer.poster ?? undefined}
            crossOrigin="anonymous"
            playsInline
            muted
            autoPlay={active}
            loop
            preload={active ? "auto" : preload ? "metadata" : "none"}
            disablePictureInPicture
            onWaiting={() => setBuffering(true)}
            onPlaying={() => {
              setBuffering(false);
              setPaused(false);
              setFailed(false);
            }}
            onCanPlay={() => {
              setBuffering(false);
              // Retry autoplay if an earlier play() was interrupted while loading.
              startPlayback();
            }}
            onError={() => setFailed(true)}
          >
            {explainer.captions && (
              <track kind="captions" src={explainer.captions} srcLang="en" label="English" />
            )}
          </video>
          {active && buffering && !failed && (
            <div className="absolute inset-0 grid place-items-center">
              <span className="size-9 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </div>
          )}
          {failed && (
            <div className="pointer-events-auto absolute inset-0 z-20 grid place-items-center bg-black/80 p-4 text-center text-sm">
              <p>
                This explainer couldn&apos;t load.{" "}
                <a href={paperUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  Watch it on alphaXiv
                </a>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reels-style controls on the video's corners: full screen (left); mute above pause (right). */}
      {active && !failed && (
        <div className={`pointer-events-none absolute inset-x-0 ${frameTop} z-20 -translate-y-1/2`}>
          <div className="relative mx-auto aspect-video" style={frameStyle}>
            <button
              type="button"
              onClick={onToggleLandscape}
              className={`pointer-events-auto absolute grid size-9 place-items-center rounded-full bg-black/55 backdrop-blur transition active:scale-90 ${
                landscape ? "top-2 right-2" : "bottom-2 left-2"
              }`}
              aria-label={landscape ? "Rotate back to portrait" : "Rotate to watch sideways"}
              aria-pressed={landscape}
            >
              <RotateIcon size={18} />
            </button>
            <div
              className={`pointer-events-auto absolute flex items-center gap-1.5 ${
                landscape ? "top-2 right-12 flex-row" : "right-2 bottom-2 flex-col"
              }`}
            >
              <button
                type="button"
                onClick={onToggleMute}
                className="grid size-7 place-items-center rounded-full bg-black/55 backdrop-blur transition active:scale-90"
                aria-label={muted ? "Unmute" : "Mute"}
                aria-pressed={!muted}
              >
                {muted ? <VolumeOffIcon size={14} /> : <VolumeOnIcon size={14} />}
              </button>
              <button
                type="button"
                onClick={togglePause}
                className="grid size-9 place-items-center rounded-full bg-black/55 backdrop-blur transition active:scale-90"
                aria-label={paused ? "Play" : "Pause"}
              >
                {paused ? <PlayIcon size={18} /> : <PauseIcon size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {active && paused && !failed && (
        <div className={`pointer-events-none absolute ${frameTop} left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/50 p-5`}>
          <PlayIcon size={34} />
        </div>
      )}

      {fast && (
        <div className="pointer-events-none absolute top-28 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm font-bold backdrop-blur">
          2x ▸▸
        </div>
      )}

      {pulse > 0 && (
        <div
          key={pulse}
          className={`animate-pop pointer-events-none absolute ${frameTop} left-1/2 z-10 rounded-full bg-black/55 p-4`}
        >
          {muted ? <VolumeOffIcon size={30} /> : <VolumeOnIcon size={30} />}
        </div>
      )}

      {/* Subtle progress bar, also a seek target. */}
      <div
        className="safe-bottom absolute inset-x-0 bottom-0 z-30 cursor-pointer pt-3"
        onPointerDown={seek}
        role="presentation"
      >
        <div className="h-[3px] w-full bg-white/20">
          <div ref={progressRef} className="h-full origin-left bg-white/90" style={{ transform: "scaleX(0)" }} />
        </div>
      </div>
    </div>
  );
}
