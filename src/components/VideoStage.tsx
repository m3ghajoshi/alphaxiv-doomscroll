"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoExplainer } from "@/lib/alphaxiv/types";
import { PlayIcon, VolumeOffIcon, VolumeOnIcon } from "./icons";

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
  onToggleMute: () => void;
  /** Called when the browser refuses to autoplay with sound. */
  onAutoplayBlocked: () => void;
};

const DRIFT_TOLERANCE_S = 0.25;

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
  onToggleMute,
  onAutoplayBlocked,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const backdropRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pulse, setPulse] = useState(0);

  // Play when active; pause and rewind when scrolled away.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!active) {
      video.pause();
      if (video.currentTime > 0) video.currentTime = 0;
      return;
    }
    let cancelled = false;
    video.muted = muted;
    video.play().catch((error: unknown) => {
      if (cancelled) return;
      if (error instanceof DOMException && error.name === "NotAllowedError" && !video.muted) {
        // Sound needs a fresh gesture on this device: fall back to muted autoplay.
        onAutoplayBlocked();
        video.muted = true;
        video.play().catch(() => setPaused(true));
      } else if (!(error instanceof DOMException && error.name === "AbortError")) {
        setPaused(true);
      }
    });
    return () => {
      cancelled = true;
    };
    // `muted` is applied by the effect below; re-running this would restart playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, onAutoplayBlocked]);

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

  const handleTap = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setPaused(false)).catch(() => setPaused(true));
      return;
    }
    onToggleMute();
    setPulse((value) => value + 1);
  }, [onToggleMute]);

  const seek = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !(video.duration > 0)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
  }, []);

  const backdropImage = explainer.poster ? `url("${explainer.poster}")` : undefined;

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
        className="absolute inset-0 z-10 cursor-pointer"
        aria-label={paused ? `Play explainer for ${title}` : muted ? "Unmute" : "Mute"}
      />

      {/* Centered 16:9 player, nudged up so the caption overlay doesn't cover it. */}
      <div className="pointer-events-none absolute inset-x-0 top-[30%] z-0 -translate-y-1/2">
        <div className="relative mx-auto aspect-video w-full overflow-hidden shadow-2xl shadow-black/60 sm:rounded-lg">
          <video
            ref={videoRef}
            className="h-full w-full bg-black object-contain"
            src={explainer.src}
            poster={explainer.poster ?? undefined}
            crossOrigin="anonymous"
            playsInline
            muted
            loop
            preload={active ? "auto" : preload ? "metadata" : "none"}
            disablePictureInPicture
            onWaiting={() => setBuffering(true)}
            onPlaying={() => {
              setBuffering(false);
              setPaused(false);
              setFailed(false);
            }}
            onCanPlay={() => setBuffering(false)}
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

      {active && paused && !failed && (
        <div className="pointer-events-none absolute top-[30%] left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/50 p-5">
          <PlayIcon size={34} />
        </div>
      )}

      {pulse > 0 && (
        <div
          key={pulse}
          className="animate-pop pointer-events-none absolute top-[30%] left-1/2 z-10 rounded-full bg-black/55 p-4"
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
