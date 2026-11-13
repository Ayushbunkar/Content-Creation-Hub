import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  AbsoluteFill,
} from "remotion";
import { ParsedSubtitles, SubtitleCue, splitSubtitleLines, getActiveCue } from "./SubtitleParser";
import { CSSProperties, FC } from "react";

export interface SubtitleStyle {
  /** Font family */
  fontFamily?: string;
  /** Font size in pixels */
  fontSize?: number;
  /** Font weight */
  fontWeight?: number | string;
  /** Text color */
  color?: string;
  /** Outline/stroke color */
  strokeColor?: string;
  /** Outline/stroke width */
  strokeWidth?: number;
  /** Background box color */
  backgroundColor?: string;
  /** Background box padding */
  backgroundPadding?: number;
  /** Background box border radius */
  backgroundBorderRadius?: number;
  /** Position from bottom (percentage or pixels) */
  bottom?: string | number;
  /** Line height multiplier */
  lineHeight?: number;
  /** Text alignment */
  textAlign?: "center" | "left" | "right";
  /** Maximum characters per line */
  maxCharsPerLine?: number;
  /** Maximum lines */
  maxLines?: number;
}

export interface AnimatedSubtitlesProps {
  /** Parsed subtitle data */
  subtitles: ParsedSubtitles;
  /** Style configuration */
  style?: SubtitleStyle;
  /** Animation type */
  animation?: "fade" | "slide-up" | "typewriter" | "pop" | "highlight";
  /** Animation duration in frames */
  animationDuration?: number;
  /** Show background box */
  showBackground?: boolean;
  /** Custom className */
  className?: string;
}

const defaultStyle: Required<SubtitleStyle> = {
  fontFamily: "'Noto Sans', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSize: 56,
  fontWeight: 600,
  color: "#FFFFFF",
  strokeColor: "#000000",
  strokeWidth: 3,
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  backgroundPadding: 16,
  backgroundBorderRadius: 8,
  bottom: "15%",
  lineHeight: 1.3,
  textAlign: "center",
  maxCharsPerLine: 42,
  maxLines: 2,
};

/**
 * AnimatedSubtitles - Renders animated subtitles synchronized with video frames
 */
export const AnimatedSubtitles: FC<AnimatedSubtitlesProps> = ({
  subtitles,
  style = {},
  animation = "fade",
  animationDuration = 15,
  showBackground = true,
  className = "",
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const mergedStyle = { ...defaultStyle, ...style };
  const activeCue = getActiveCue(subtitles.cues, frame);

  if (!activeCue) {
    return null;
  }

  // Calculate animation progress
  const framesSinceStart = frame - activeCue.startFrame;
  const framesUntilEnd = activeCue.endFrame - frame;
  const progress = Math.min(1, framesSinceStart / animationDuration);
  const exitProgress = Math.min(1, framesUntilEnd / animationDuration);

  // Split text into lines
  const lines = splitSubtitleLines(
    activeCue.text,
    mergedStyle.maxCharsPerLine,
    mergedStyle.maxLines
  );

  // Animation styles
  let opacity = 1;
  let transform: CSSProperties["transform"] = "none";
  let clipPath: CSSProperties["clipPath"] = "none";

  switch (animation) {
    case "fade":
      opacity = interpolate(progress, [0, 1], [0, 1], {
        easing: Easing.out(Easing.quad),
      });
      if (framesUntilEnd < animationDuration) {
        opacity *= interpolate(exitProgress, [0, 1], [0, 1], {
          easing: Easing.in(Easing.quad),
        });
      }
      break;

    case "slide-up":
      opacity = interpolate(progress, [0, 1], [0, 1], { easing: Easing.out(Easing.quad) });
      transform = `translateY(${interpolate(progress, [0, 1], [30, 0], { easing: Easing.out(Easing.cubic) })}px)`;
      if (framesUntilEnd < animationDuration) {
        opacity *= interpolate(exitProgress, [0, 1], [0, 1], { easing: Easing.in(Easing.quad) });
        transform += ` translateY(${interpolate(exitProgress, [0, 1], [0, -20], { easing: Easing.in(Easing.cubic) })}px)`;
      }
      break;

    case "typewriter":
      // Typewriter effect per character
      const totalChars = activeCue.text.length;
      const charsPerFrame = totalChars / animationDuration;
      const visibleChars = Math.min(totalChars, Math.floor(framesSinceStart * charsPerFrame));
      // We'll handle this with clip-path on each line
      break;

    case "pop":
      const popProgress = interpolate(progress, [0, 1], [0, 1], { easing: Easing.out(Easing.back(2)) });
      transform = `scale(${popProgress})`;
      opacity = popProgress;
      if (framesUntilEnd < animationDuration) {
        const exitPop = interpolate(exitProgress, [0, 1], [1, 0], { easing: Easing.in(Easing.back(2)) });
        transform = `scale(${exitPop})`;
        opacity = exitPop;
      }
      break;

    case "highlight":
      // Word-by-word highlight - would need word timing data
      opacity = 1;
      break;
  }

  const containerStyle: CSSProperties = {
    position: "absolute",
    bottom: typeof mergedStyle.bottom === "number" ? `${mergedStyle.bottom}px` : mergedStyle.bottom,
    left: "50%",
    transform: `translateX(-50%) ${transform}`,
    textAlign: mergedStyle.textAlign,
    zIndex: 100,
    pointerEvents: "none",
    opacity,
    clipPath,
  };

  const lineStyles: CSSProperties = {
    fontFamily: mergedStyle.fontFamily,
    fontSize: `${mergedStyle.fontSize}px`,
    fontWeight: mergedStyle.fontWeight,
    color: mergedStyle.color,
    lineHeight: mergedStyle.lineHeight,
    textShadow: `${mergedStyle.strokeWidth}px ${mergedStyle.strokeWidth}px 0 ${mergedStyle.strokeColor},
                 -${mergedStyle.strokeWidth}px ${mergedStyle.strokeWidth}px 0 ${mergedStyle.strokeColor},
                 ${mergedStyle.strokeWidth}px -${mergedStyle.strokeWidth}px 0 ${mergedStyle.strokeColor},
                 -${mergedStyle.strokeWidth}px -${mergedStyle.strokeWidth}px 0 ${mergedStyle.strokeColor}`,
    WebkitTextStroke: `${mergedStyle.strokeWidth}px ${mergedStyle.strokeColor}`,
    paintOrder: "stroke fill",
  };

  const backgroundStyle: CSSProperties = showBackground ? {
    backgroundColor: mergedStyle.backgroundColor,
    padding: `${mergedStyle.backgroundPadding}px ${mergedStyle.backgroundPadding * 1.5}px`,
    borderRadius: `${mergedStyle.backgroundBorderRadius}px`,
    display: "inline-block",
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
  } : {};

  return (
    <AbsoluteFill style={containerStyle} className={className}>
      <div style={backgroundStyle}>
        {lines.map((line, i) => (
          <div key={i} style={lineStyle}>
            {line}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const lineStyle: CSSProperties = {
  display: "block",
  whiteSpace: "nowrap",
};

/**
 * KaraokeSubtitles - Word-by-word highlighting (requires word-level timing)
 * For use with Whisper's word-level timestamps
 */
export interface WordTiming {
  word: string;
  start: number;
  end: number;
  startFrame: number;
  endFrame: number;
}

export interface KaraokeSubtitlesProps {
  /** Array of words with timing */
  words: WordTiming[];
  /** Style configuration */
  style?: SubtitleStyle;
  /** Highlight color for active word */
  highlightColor?: string;
  /** Default word color */
  defaultColor?: string;
}

export const KaraokeSubtitles: FC<KaraokeSubtitlesProps> = ({
  words,
  style = {},
  highlightColor = "#FFD700",
  defaultColor = "#FFFFFF",
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const mergedStyle = { ...defaultStyle, ...style };

  // Group words into lines (approx 42 chars per line)
  const lines: WordTiming[][] = [];
  let currentLine: WordTiming[] = [];
  let currentLineLength = 0;

  for (const word of words) {
    if (currentLineLength + word.word.length > mergedStyle.maxCharsPerLine && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [];
      currentLineLength = 0;
    }
    currentLine.push(word);
    currentLineLength += word.word.length + 1; // +1 for space
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // Limit to max lines
  const displayLines = lines.slice(0, mergedStyle.maxLines);

  return (
    <AbsoluteFill
      style={{
        position: "absolute",
        bottom: typeof mergedStyle.bottom === "number" ? `${mergedStyle.bottom}px` : mergedStyle.bottom,
        left: "50%",
        transform: "translateX(-50%)",
        textAlign: mergedStyle.textAlign,
        zIndex: 100,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          backgroundColor: mergedStyle.backgroundColor,
          padding: `${mergedStyle.backgroundPadding}px ${mergedStyle.backgroundPadding * 1.5}px`,
          borderRadius: `${mergedStyle.backgroundBorderRadius}px`,
          display: "inline-block",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        {displayLines.map((line, lineIndex) => (
          <div key={lineIndex} style={{ display: "block", whiteSpace: "nowrap" }}>
            {line.map((word, wordIndex) => {
              const isActive = frame >= word.startFrame && frame < word.endFrame;
              const wordColor = isActive ? highlightColor : defaultColor;

              return (
                <span
                  key={wordIndex}
                  style={{
                    ...lineStyle,
                    fontFamily: mergedStyle.fontFamily,
                    fontSize: `${mergedStyle.fontSize}px`,
                    fontWeight: mergedStyle.fontWeight,
                    color: wordColor,
                    lineHeight: mergedStyle.lineHeight,
                    textShadow: `${mergedStyle.strokeWidth}px ${mergedStyle.strokeWidth}px 0 ${mergedStyle.strokeColor},
                                 -${mergedStyle.strokeWidth}px ${mergedStyle.strokeWidth}px 0 ${mergedStyle.strokeColor},
                                 ${mergedStyle.strokeWidth}px -${mergedStyle.strokeWidth}px 0 ${mergedStyle.strokeColor},
                                 -${mergedStyle.strokeWidth}px -${mergedStyle.strokeWidth}px 0 ${mergedStyle.strokeColor}`,
                    WebkitTextStroke: `${mergedStyle.strokeWidth}px ${mergedStyle.strokeColor}`,
                    paintOrder: "stroke fill",
                    transition: "color 0.05s ease-out",
                  }}
                >
                  {word.word}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/**
 * SubtitleDebugger - Shows current frame and active cue info (for development)
 */
export interface SubtitleDebuggerProps {
  subtitles: ParsedSubtitles;
  enabled?: boolean;
}

export const SubtitleDebugger: FC<SubtitleDebuggerProps> = ({ subtitles, enabled = false }) => {
  if (!enabled) return null;

  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const activeCue = getActiveCue(subtitles.cues, frame);

  return (
    <AbsoluteFill
      style={{
        position: "absolute",
        top: 20,
        left: 20,
        background: "rgba(0,0,0,0.8)",
        color: "#0F0",
        padding: "10px 15px",
        borderRadius: 4,
        fontFamily: "monospace",
        fontSize: 14,
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      <div>Frame: {frame} / {subtitles.cues[subtitles.cues.length - 1]?.endFrame || "?"}</div>
      <div>Time: {(frame / fps).toFixed(2)}s</div>
      <div>Active Cue: {activeCue ? `${activeCue.index}: "${activeCue.text.substring(0, 40)}..."` : "None"}</div>
      <div>Cues Total: {subtitles.cues.length}</div>
    </AbsoluteFill>
  );
};

// Re-export parser utilities for backwards compatibility
export { loadSubtitles, parseSRT, getActiveCue, splitSubtitleLines } from "./SubtitleParser";
export type { ParsedSubtitles, SubtitleCue } from "./SubtitleParser";
