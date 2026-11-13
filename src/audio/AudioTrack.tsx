import { Audio } from "@remotion/media";
import { VolumeProp, useCurrentFrame, useVideoConfig, interpolate, Easing, staticFile } from "remotion";
import { ReactElement } from "react";

export interface AudioTrackProps {
  /** Path to audio file (relative to public folder or full URL) */
  src: string;
  /** Volume level (0-1) or a function returning volume for each frame */
  volume?: VolumeProp;
  /** Start playback from this frame (trim beginning) */
  startFrom?: number;
  /** Loop the audio */
  loop?: boolean;
  /** Fade in duration in frames */
  fadeIn?: number;
  /** Fade out duration in frames */
  fadeOut?: number;
  /** Playback rate (1 = normal) */
  playbackRate?: number;
  /** Mute the track */
  muted?: boolean;
  /** Trim audio after this many seconds from start */
  trimAfter?: number;
  /** Premount frames for smoother playback */
  premountFor?: number;
}

/**
 * AudioTrack - A wrapper around @remotion/media's Audio component
 * with additional features for documentary production:
 * - Volume keyframing (fade in/out)
 * - Delayed start (startFrom)
 * - Looping
 * - Playback rate control
 */
export const AudioTrack: React.FC<AudioTrackProps> = ({
  src,
  volume = 1,
  startFrom = 0,
  loop = false,
  fadeIn = 0,
  fadeOut = 0,
  playbackRate = 1,
  muted = false,
  trimAfter,
  premountFor = 0,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  // Calculate volume with fade in/out if volume is a number
  const computedVolume: VolumeProp = typeof volume === "number" ? (() => {
    let vol = volume;

    // Fade in
    if (fadeIn > 0 && frame < startFrom + fadeIn) {
      const progress = (frame - startFrom) / fadeIn;
      vol *= interpolate(progress, [0, 1], [0, 1], {
        easing: Easing.inOut(Easing.quad),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }

    // Fade out
    if (fadeOut > 0) {
      const audioEndFrame = startFrom + (trimAfter ? trimAfter * fps : durationInFrames);
      if (frame > audioEndFrame - fadeOut) {
        const progress = (frame - (audioEndFrame - fadeOut)) / fadeOut;
        vol *= interpolate(progress, [0, 1], [1, 0], {
          easing: Easing.inOut(Easing.quad),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
      }
    }

    return Math.max(0, Math.min(1, vol));
  }) : volume;

  // Resolve src using staticFile if it's a relative path starting with / or not starting with http/data
  const resolvedSrc = (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:"))
    ? src
    : staticFile(src.replace(/^\//, ""));

  return (
    <Audio
      src={resolvedSrc}
      trimBefore={startFrom / fps}
      trimAfter={trimAfter}
      volume={computedVolume}
      loop={loop}
      playbackRate={playbackRate}
      preservePitch={playbackRate !== 1}
      muted={muted}
      premountFor={premountFor}
      style={{ display: "none" }}
    />
  );
};

export interface AudioTrackGroupProps {
  /** Narration track - main voiceover */
  narration?: AudioTrackProps;
  /** Background music track - lower volume, loops */
  music?: AudioTrackProps;
  /** Ambient/atmosphere track */
  ambient?: AudioTrackProps;
  /** Sound effects array */
  soundEffects?: AudioTrackProps[];
}

/**
 * AudioTrackGroup - Manages multiple audio tracks for documentary production
 * Typical setup:
 * - Narration: Primary voiceover, no loop, volume ~1.0
 * - Music: Background music, loops, volume ~0.1-0.3
 * - Ambient: Atmosphere sounds, loops, volume ~0.05-0.15
 * - Sound effects: One-shots, triggered at specific frames
 */
export const AudioTrackGroup: React.FC<AudioTrackGroupProps> = ({
  narration,
  music,
  ambient,
  soundEffects = [],
}) => {
  return (
    <>
      {narration && <AudioTrack {...narration} />}
      {music && <AudioTrack {...music} />}
      {ambient && <AudioTrack {...ambient} />}
      {soundEffects.map((sfx, i) => (
        <AudioTrack key={`sfx-${i}`} {...sfx} />
      ))}
    </>
  );
};

/**
 * Create a volume keyframe function for complex volume automation
 */
export function createVolumeKeyframes(
  keyframes: { frame: number; volume: number }[],
  defaultVolume = 1
): (frame: number) => number {
  return (frame: number) => {
    if (keyframes.length === 0) return defaultVolume;

    // Before first keyframe
    if (frame <= keyframes[0].frame) {
      return keyframes[0].volume;
    }

    // After last keyframe
    if (frame >= keyframes[keyframes.length - 1].frame) {
      return keyframes[keyframes.length - 1].volume;
    }

    // Between keyframes - linear interpolation
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (frame >= keyframes[i].frame && frame <= keyframes[i + 1].frame) {
        const t = (frame - keyframes[i].frame) / (keyframes[i + 1].frame - keyframes[i].frame);
        return keyframes[i].volume + t * (keyframes[i + 1].volume - keyframes[i].volume);
      }
    }

    return defaultVolume;
  };
}

/**
 * Create a ducking volume function (lower volume when narration plays)
 */
export function createDuckingVolume(
  narrationFrames: { start: number; end: number }[],
  baseVolume: number,
  duckVolume: number,
  fadeFrames = 15
): (frame: number) => number {
  return (frame: number) => {
    for (const { start, end } of narrationFrames) {
      // Fade in to duck volume
      if (frame >= start - fadeFrames && frame < start) {
        const t = (frame - (start - fadeFrames)) / fadeFrames;
        return baseVolume + t * (duckVolume - baseVolume);
      }
      // Ducked during narration
      if (frame >= start && frame < end) {
        return duckVolume;
      }
      // Fade out from duck volume
      if (frame >= end && frame < end + fadeFrames) {
        const t = (frame - end) / fadeFrames;
        return duckVolume + t * (baseVolume - duckVolume);
      }
    }
    return baseVolume;
  };
}