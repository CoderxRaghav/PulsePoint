"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

interface SpaceBackgroundProps {
  className?: string;
}

export function SpaceBackground({ className = "" }: SpaceBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [useStillOnly, setUseStillOnly] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    // 1. Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 2. Respect data-saver if available
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean };
    };
    const isDataSaver = nav.connection?.saveData === true;

    if (prefersReducedMotion || isDataSaver) {
      const stillTimer = setTimeout(() => {
        setUseStillOnly(true);
      }, 0);
      return () => clearTimeout(stillTimer);
    }

    const video = videoRef.current;
    if (!video) return;

    // Ensure audio tracks are muted to guarantee immediate autoplay permission
    video.defaultMuted = true;
    video.muted = true;

    const playVideo = () => {
      const promise = video.play();
      if (promise !== undefined) {
        promise.catch(() => {
          // If browser policy blocks autoplay, gracefully keep still image active
          setUseStillOnly(true);
        });
      }
    };

    // Pause when offscreen or tab hidden; resume when visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
      } else if (!useStillOnly) {
        playVideo();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Pause playback when scrolled out of view to conserve GPU/CPU
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            playVideo();
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.05 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Trigger playback on first visit / mount
    playVideo();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      observer.disconnect();
    };
  }, [useStillOnly]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}
    >
      {/* 1. Still fallback image (rendered immediately without waiting for video) */}
      <div className="absolute inset-0 w-full h-full">
        <Image
          src="/images/hero-globe.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-bottom"
        />
      </div>

      {/* 2. Looping globe video (faded in over still when first frame renders) */}
      {!useStillOnly && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          tabIndex={-1}
          aria-hidden="true"
          preload="auto"
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => setVideoReady(true)}
          className={`absolute inset-0 w-full h-full object-cover object-bottom transition-opacity duration-700 ease-out ${
            videoReady ? "opacity-100" : "opacity-0"
          }`}
        >
          <source src="/videos/hero-globe.mp4" type="video/mp4" />
        </video>
      )}

      {/* 3. Responsive feathering and contrast overlays:
          - Top feathering for phone headers and navigation readability.
          - Side feathering on ultra-wide screens to gently blend edges.
          - Bottom feathering melting globe smoothly into charcoal section below.
      */}
      <div className="absolute inset-x-0 top-0 h-44 sm:h-64 bg-gradient-to-b from-[#070709] via-[#070709]/70 to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 left-0 w-20 sm:w-48 bg-gradient-to-r from-[#070709] to-transparent pointer-events-none opacity-80" />
      <div className="absolute inset-y-0 right-0 w-20 sm:w-48 bg-gradient-to-l from-[#070709] to-transparent pointer-events-none opacity-80" />
      <div className="absolute inset-x-0 bottom-0 h-48 sm:h-72 bg-gradient-to-t from-[#070709] via-[#070709]/70 to-transparent pointer-events-none" />
    </div>
  );
}
