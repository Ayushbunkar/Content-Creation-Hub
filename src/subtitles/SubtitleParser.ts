import { staticFile } from "remotion";

/**
 * SRT Subtitle Parser for Remotion
 * Parses SRT files into structured data for animated subtitles
 */

export interface SubtitleCue {
  index: number;
  startTime: number;  // in seconds
  endTime: number;    // in seconds
  text: string;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
}

export interface ParsedSubtitles {
  cues: SubtitleCue[];
  totalDuration: number;
}

/**
 * Parse SRT content string into structured cues
 */
export function parseSRT(srtContent: string, fps: number): ParsedSubtitles {
  const cues: SubtitleCue[] = [];

  // Normalize line endings
  const normalized = srtContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Split by double newline (separates cues)
  const blocks = normalized.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    // Line 0: index (optional, we'll use array index)
    // Line 1: timestamp --> timestamp
    // Line 2+: text (can be multiple lines)

    const timeLine = lines[1];
    const timeMatch = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,\.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,\.](\d{3})/
    );

    if (!timeMatch) continue;

    const startTime = parseTimecode(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
    const endTime = parseTimecode(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);

    const text = lines.slice(2).join("\n").trim();

    const startFrame = Math.round(startTime * fps);
    const endFrame = Math.round(endTime * fps);

    cues.push({
      index: cues.length + 1,
      startTime,
      endTime,
      text,
      startFrame,
      endFrame,
      durationFrames: endFrame - startFrame,
    });
  }

  // Sort by start time
  cues.sort((a, b) => a.startTime - b.startTime);

  const totalDuration = cues.length > 0
    ? Math.max(...cues.map(c => c.endTime))
    : 0;

  return { cues, totalDuration };
}

function parseTimecode(hours: string, minutes: string, seconds: string, millis: string): number {
  return (
    parseInt(hours, 10) * 3600 +
    parseInt(minutes, 10) * 60 +
    parseInt(seconds, 10) +
    parseInt(millis, 10) / 1000
  );
}

/**
 * Load and parse SRT file from public folder
 */
export async function loadSubtitles(srtPath: string, fps: number): Promise<ParsedSubtitles> {
  const resolvedPath = (srtPath.startsWith("http://") || srtPath.startsWith("https://") || srtPath.startsWith("data:"))
    ? srtPath
    : staticFile(srtPath.replace(/^\//, ""));
  const response = await fetch(resolvedPath);
  if (!response.ok) {
    throw new Error(`Failed to load subtitles: ${response.statusText}`);
  }
  const text = await response.text();
  return parseSRT(text, fps);
}

/**
 * Get active subtitle cue for current frame
 */
export function getActiveCue(cues: SubtitleCue[], frame: number): SubtitleCue | null {
  for (const cue of cues) {
    if (frame >= cue.startFrame && frame < cue.endFrame) {
      return cue;
    }
  }
  return null;
}

/**
 * Get upcoming cues (for preloading/animation)
 */
export function getUpcomingCues(cues: SubtitleCue[], frame: number, lookaheadFrames: number = 30): SubtitleCue[] {
  return cues.filter(cue =>
    cue.startFrame > frame && cue.startFrame <= frame + lookaheadFrames
  );
}

/**
 * Split subtitle text into lines for better readability
 * Max characters per line, tries to break at word boundaries
 */
export function splitSubtitleLines(text: string, maxCharsPerLine: number = 42, maxLines: number = 2): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        if (lines.length >= maxLines) break;
      }
      currentLine = word;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [text];
}