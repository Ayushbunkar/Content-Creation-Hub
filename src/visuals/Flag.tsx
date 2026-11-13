import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { CSSProperties, FC, SVGProps } from "react";

/**
 * Flag definitions for common countries
 * Each flag is defined as a function returning SVG elements
 */
export interface FlagDefinition {
  aspectRatio: number; // width / height
  render: (width: number, height: number) => React.ReactNode;
}

// Flag registry
const flagRegistry: Record<string, FlagDefinition> = {
  // India
  IN: {
    aspectRatio: 3 / 2,
    render: (w, h) => (
      <>
        <rect x={0} y={0} width={w} height={h / 3} fill="#FF9933" />
        <rect x={0} y={h / 3} width={w} height={h / 3} fill="#FFFFFF" />
        <rect x={0} y={2 * h / 3} width={w} height={h / 3} fill="#138808" />
        {/* Ashoka Chakra */}
        <circle
          cx={w / 2}
          cy={h / 2}
          r={h / 6}
          fill="none"
          stroke="#000080"
          strokeWidth={Math.max(1, h / 90)}
        />
        {/* 24 spokes */}
        {Array.from({ length: 24 }, (_, i) => (
          <line
            key={i}
            x1={w / 2}
            y1={h / 2}
            x2={w / 2 + (h / 6) * Math.cos(i * Math.PI / 12 - Math.PI / 2)}
            y2={h / 2 + (h / 6) * Math.sin(i * Math.PI / 12 - Math.PI / 2)}
            stroke="#000080"
            strokeWidth={Math.max(0.5, h / 180)}
          />
        ))}
      </>
    ),
  },

  // United States
  US: {
    aspectRatio: 1.9,
    render: (w, h) => {
      const stripeHeight = h / 13;
      const cantonWidth = w * 0.4;
      const cantonHeight = stripeHeight * 7;
      return (
        <>
          {/* Stripes */}
          {Array.from({ length: 13 }, (_, i) => (
            <rect
              key={i}
              x={0}
              y={i * stripeHeight}
              width={w}
              height={stripeHeight}
              fill={i % 2 === 0 ? "#B22234" : "#FFFFFF"}
            />
          ))}
          {/* Canton */}
          <rect x={0} y={0} width={cantonWidth} height={cantonHeight} fill="#3C3B6E" />
          {/* Stars - 50 stars in 9 rows alternating 6/5 */}
          {Array.from({ length: 9 }, (_, row) => {
            const starsInRow = row % 2 === 0 ? 6 : 5;
            const yOffset = (row + 0.5) * (cantonHeight / 9);
            const xStart = row % 2 === 0 ? cantonWidth / 13 : cantonWidth / 6.5;
            const xStep = cantonWidth / (starsInRow === 6 ? 6.5 : 5.5);
            return Array.from({ length: starsInRow }, (_, col) => (
              <polygon
                key={`${row}-${col}`}
                points={starPoints(
                  xStart + col * xStep,
                  yOffset,
                  Math.min(cantonWidth, cantonHeight) / 30
                )}
                fill="#FFFFFF"
              />
            ));
          })}
        </>
      );
    },
  },

  // China
  CN: {
    aspectRatio: 3 / 2,
    render: (w, h) => (
      <>
        <rect x={0} y={0} width={w} height={h} fill="#DE2910" />
        {/* Large star */}
        <polygon
          points={starPoints(w * 0.1, h * 0.2, h * 0.15)}
          fill="#FFDE00"
        />
        {/* Four small stars */}
        <polygon points={starPoints(w * 0.22, h * 0.1, h * 0.05)} fill="#FFDE00" />
        <polygon points={starPoints(w * 0.26, h * 0.2, h * 0.05)} fill="#FFDE00" />
        <polygon points={starPoints(w * 0.26, h * 0.3, h * 0.05)} fill="#FFDE00" />
        <polygon points={starPoints(w * 0.22, h * 0.4, h * 0.05)} fill="#FFDE00" />
      </>
    ),
  },

  // Russia
  RU: {
    aspectRatio: 2 / 1,
    render: (w, h) => (
      <>
        <rect x={0} y={0} width={w} height={h / 3} fill="#FFFFFF" />
        <rect x={0} y={h / 3} width={w} height={h / 3} fill="#0039A6" />
        <rect x={0} y={2 * h / 3} width={w} height={h / 3} fill="#D52B1E" />
      </>
    ),
  },

  // United Kingdom
  GB: {
    aspectRatio: 2 / 1,
    render: (w, h) => (
      <>
        <rect x={0} y={0} width={w} height={h} fill="#012169" />
        {/* White diagonals (St Andrew's Cross) */}
        <path
          d={`M0,0 L${w},${h} M${w},0 L0,${h}`}
          stroke="#FFFFFF"
          strokeWidth={h / 10}
          fill="none"
        />
        {/* Red diagonals (St Patrick's Cross) */}
        <path
          d={`M0,0 L${w},${h} M${w},0 L0,${h}`}
          stroke="#C8102E"
          strokeWidth={h / 15}
          fill="none"
        />
        {/* Red vertical cross (St George's Cross) */}
        <rect x={w * 0.4} y={0} width={w * 0.2} height={h} fill="#C8102E" />
        <rect x={0} y={h * 0.4} width={w} height={h * 0.2} fill="#C8102E" />
        {/* White vertical cross */}
        <rect x={w * 0.425} y={0} width={w * 0.15} height={h} fill="#FFFFFF" />
        <rect x={0} y={h * 0.425} width={w} height={h * 0.15} fill="#FFFFFF" />
      </>
    ),
  },

  // European Union
  EU: {
    aspectRatio: 3 / 2,
    render: (w, h) => (
      <>
        <rect x={0} y={0} width={w} height={h} fill="#003399" />
        {/* 12 stars in a circle */}
        {Array.from({ length: 12 }, (_, i) => {
          const angle = i * Math.PI / 6 - Math.PI / 2;
          const radius = h * 0.35;
          return (
            <polygon
              key={i}
              points={starPoints(
                w / 2 + radius * Math.cos(angle),
                h / 2 + radius * Math.sin(angle),
                h * 0.07
              )}
              fill="#FFCC00"
              transform={`rotate(${i * 30 + 90} ${w / 2 + radius * Math.cos(angle)} ${h / 2 + radius * Math.sin(angle)})`}
            />
          );
        })}
      </>
    ),
  },

  // Pakistan
  PK: {
    aspectRatio: 3 / 2,
    render: (w, h) => (
      <>
        <rect x={0} y={0} width={w} height={h} fill="#01411C" />
        {/* White vertical stripe */}
        <rect x={0} y={0} width={w * 0.25} height={h} fill="#FFFFFF" />
        {/* Crescent and star */}
        <path
          d={`M${w * 0.55},${h * 0.25} A${h * 0.2},${h * 0.2} 0 0 1 ${w * 0.55},${h * 0.75} A${h * 0.15},${h * 0.15} 0 0 0 ${w * 0.55},${h * 0.25} Z`}
          fill="#FFFFFF"
        />
        <polygon
          points={starPoints(w * 0.72, h * 0.5, h * 0.08)}
          fill="#FFFFFF"
        />
      </>
    ),
  },

  // Bangladesh
  BD: {
    aspectRatio: 3 / 2,
    render: (w, h) => (
      <>
        <rect x={0} y={0} width={w} height={h} fill="#006A4E" />
        <circle
          cx={w * 0.45}
          cy={h * 0.5}
          r={h * 0.2}
          fill="#F42A41"
        />
      </>
    ),
  },

  // Generic flag for unknown countries
  XX: {
    aspectRatio: 3 / 2,
    render: (w, h) => (
      <>
        <rect x={0} y={0} width={w} height={h / 2} fill="#3498db" />
        <rect x={0} y={h / 2} width={w} height={h / 2} fill="#e74c3c" />
        <text
          x={w / 2}
          y={h / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff"
          fontSize={Math.min(w, h) * 0.15}
          fontWeight="bold"
        >
          ?
        </text>
      </>
    ),
  },
};

function starPoints(cx: number, cy: number, radius: number): string {
  const points: string[] = [];
  for (let i = 0; i < 5; i++) {
    const outerAngle = i * 4 * Math.PI / 5 - Math.PI / 2;
    const innerAngle = (i * 4 + 2) * Math.PI / 5 - Math.PI / 2;
    points.push(`${cx + radius * Math.cos(outerAngle)},${cy + radius * Math.sin(outerAngle)}`);
    points.push(`${cx + radius * 0.38 * Math.cos(innerAngle)},${cy + radius * 0.38 * Math.sin(innerAngle)}`);
  }
  return points.join(" ");
}

export interface FlagProps {
  /** Country code (ISO 3166-1 alpha-2) */
  countryCode: string;
  /** Width in pixels */
  width: number;
  /** Height in pixels (optional, calculated from aspect ratio if not provided) */
  height?: number;
  /** Animation type */
  animation?: "wave" | "raise" | "fade" | "flutter" | "none";
  /** Animation duration in frames */
  animationDuration?: number;
  /** Animation delay in frames */
  animationDelay?: number;
  /** Wave amplitude (for wave animation) */
  waveAmplitude?: number;
  /** Wave frequency (for wave animation) */
  waveFrequency?: number;
  /** Custom style */
  style?: CSSProperties;
  /** Custom flag definition (overrides registry) */
  customFlag?: FlagDefinition;
}

/**
 * Flag - Animated flag component with built-in country flags
 */
export const Flag: FC<FlagProps> = ({
  countryCode,
  width,
  height,
  animation = "wave",
  animationDuration = 120,
  animationDelay = 0,
  waveAmplitude = 8,
  waveFrequency = 0.02,
  style = {},
  customFlag,
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const flagDef = customFlag || flagRegistry[countryCode.toUpperCase()] || flagRegistry.XX;
  const h = height || width / flagDef.aspectRatio;

  const animProgress = Math.min(1, Math.max(0, (frame - animationDelay) / animationDuration));

  // Generate flag SVG
  const flagContent = flagDef.render(width, h);

  // Animation transforms
  let transform: CSSProperties["transform"] = "none";
  let opacity = 1;
  let filter: CSSProperties["filter"] = "none";

  switch (animation) {
    case "wave":
      // SVG-based wave would be better, but we'll use CSS transform for container
      filter = `drop-shadow(0 4px 12px rgba(0,0,0,0.3))`;
      break;
    case "raise":
      transform = `translateY(${interpolate(animProgress, [0, 1], [h, 0], { easing: Easing.out(Easing.cubic) })}px)`;
      opacity = animProgress;
      break;
    case "fade":
      opacity = interpolate(animProgress, [0, 1], [0, 1], { easing: Easing.out(Easing.quad) });
      break;
    case "flutter":
      transform = `rotate(${interpolate(animProgress, [0, 0.5, 1], [-3, 3, -3], { easing: Easing.inOut(Easing.quad), extrapolateLeft: "clamp", extrapolateRight: "clamp" })}deg)`;
      break;
  }

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${h}px`,
        transform,
        transformOrigin: "center center",
        opacity,
        filter,
        ...style,
      }}
    >
      <svg
        width={width}
        height={h}
        viewBox={`0 0 ${width} ${h}`}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
        }}
        preserveAspectRatio="none"
      >
        {flagContent}
      </svg>
    </div>
  );
};

/**
 * WavingFlag - Flag with realistic wave animation using SVG distortion
 */
export interface WavingFlagProps extends Omit<FlagProps, "animation"> {
  /** Number of wave segments */
  segments?: number;
  /** Wave speed (cycles per second) */
  waveSpeed?: number;
  /** Wind direction: "left" | "right" */
  windDirection?: "left" | "right";
}

export const WavingFlag: FC<WavingFlagProps> = ({
  countryCode,
  width,
  height,
  segments = 20,
  waveSpeed = 0.5,
  windDirection = "right",
  animationDuration = 120,
  animationDelay = 0,
  style = {},
  customFlag,
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const flagDef = customFlag || flagRegistry[countryCode.toUpperCase()] || flagRegistry.XX;
  const h = height || width / flagDef.aspectRatio;

  const animProgress = Math.min(1, Math.max(0, (frame - animationDelay) / animationDuration));
  const time = frame / fps;
  const waveFrequency = 0.05;
  const waveAmplitude = 8;

  // Create waved flag using SVG path distortion
  const segmentWidth = width / segments;
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i <= segments; i++) {
    const x = i * segmentWidth;
    // Wave function
    const wavePhase = time * waveSpeed * Math.PI * 2;
    const waveOffset = Math.sin(x * waveFrequency + wavePhase) * waveAmplitude * animProgress;

    // Actually, let's create a proper waved polygon
    points.push({ x, y: waveOffset }); // Top edge
  }
  for (let i = segments; i >= 0; i--) {
    const x = i * segmentWidth;
    const wavePhase = time * waveSpeed * Math.PI * 2;
    const waveOffset = Math.sin(x * waveFrequency + wavePhase) * waveAmplitude * animProgress;
    points.push({ x, y: h + waveOffset }); // Bottom edge
  }

  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${h}px`,
        ...style,
      }}
    >
      <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
        <defs>
          <clipPath id={`flag-clip-${countryCode}-${frame}`}>
            <polygon points={polygonPoints} />
          </clipPath>
        </defs>
        <g clipPath={`url(#flag-clip-${countryCode}-${frame})`}>
          {flagDef.render(width, h)}
        </g>
      </svg>
    </div>
  );
};

/**
 * FlagIcon - Small flag icon for use in UI/labels
 */
export interface FlagIconProps {
  countryCode: string;
  size?: number;
  shape?: "rect" | "circle" | "wave";
  style?: CSSProperties;
}

export const FlagIcon: FC<FlagIconProps> = ({
  countryCode,
  size = 32,
  shape = "rect",
  style = {},
}) => {
  const flagDef = flagRegistry[countryCode.toUpperCase()] || flagRegistry.XX;
  const h = size / flagDef.aspectRatio;

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${h}px`,
        borderRadius: shape === "circle" ? "50%" : shape === "wave" ? "4px" : "2px",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        ...style,
      }}
    >
      <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} style={{ display: "block" }}>
        {flagDef.render(size, h)}
      </svg>
    </div>
  );
};

/**
 * Register a custom flag
 */
export function registerFlag(code: string, definition: FlagDefinition): void {
  flagRegistry[code.toUpperCase()] = definition;
}

/**
 * Get list of available flag codes
 */
export function getAvailableFlags(): string[] {
  return Object.keys(flagRegistry).filter(k => k !== "XX");
}