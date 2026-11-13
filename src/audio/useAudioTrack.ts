import { useCurrentFrame, useVideoConfig } from "remotion";
import { useEffect, useRef, useState } from "react";

export interface AudioTrackConfig {
  src: string;
  volume?: number;
  startFrom?: number;
  loop?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  playbackRate?: number;
  muted?: boolean;
}

/**
 * Hook for controlling an audio track with frame-accurate timing
 */
export function useAudioTrack(config: AudioTrackConfig) {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  // Initialize audio element
  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio();
    audio.src = config.src;
    audio.preload = "auto";
    audio.loop = config.loop ?? false;
    audio.playbackRate = config.playbackRate ?? 1;
    audio.muted = config.muted ?? false;
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.pause();
      audio.src = "";
    };
  }, [config.src, config.loop, config.playbackRate, config.muted]);

  // Calculate current time based on frame
  const startFrom = config.startFrom ?? 0;
  const currentFrame = frame - startFrom;
  const currentTime = currentFrame / fps;

  // Calculate volume with fade in/out
  let volume = config.volume ?? 1;
  const fadeIn = config.fadeIn ?? 0;
  const fadeOut = config.fadeOut ?? 0;

  if (fadeIn > 0 && currentFrame < fadeIn) {
    volume *= currentFrame / fadeIn;
  }

  if (fadeOut > 0 && duration !== null) {
    const fadeOutStartFrame = Math.max(0, duration * fps - fadeOut);
    if (currentFrame > fadeOutStartFrame) {
      volume *= 1 - (currentFrame - fadeOutStartFrame) / fadeOut;
    }
  }

  volume = Math.max(0, Math.min(1, volume));

  // Apply to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = config.muted ?? false;

      // Seek to correct position
      const targetTime = Math.max(0, currentTime);
      if (Math.abs(audioRef.current.currentTime - targetTime) > 0.1) {
        audioRef.current.currentTime = targetTime;
      }

      // Play/pause based on frame
      if (currentFrame >= 0 && currentFrame < durationInFrames) {
        if (audioRef.current.paused) {
          audioRef.current.play().catch(() => {});
        }
      } else {
        if (!audioRef.current.paused) {
          audioRef.current.pause();
        }
      }
    }
  }, [frame, volume, config.muted, currentTime, durationInFrames]);

  return {
    duration,
    currentTime,
    volume,
    play: () => audioRef.current?.play(),
    pause: () => audioRef.current?.pause(),
  };
}

/**
 * Hook for managing multiple audio tracks
 */
export function useAudioMixer(tracks: Record<string, AudioTrackConfig>) {
  const trackRefs = useRef<Record<string, ReturnType<typeof useAudioTrack> | null>>({});

  // This is a placeholder - in practice you'd use multiple useAudioTrack calls
  // in the component and combine their outputs
  return trackRefs.current;
}