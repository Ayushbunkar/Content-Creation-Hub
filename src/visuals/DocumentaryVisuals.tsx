import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  AbsoluteFill,
} from "remotion";
import React, { CSSProperties, FC, SVGProps } from "react";

/**
 * AnimatedMap - Renders an SVG map with animated regions, paths, and markers
 */
export interface MapRegion {
  id: string;
  path: string;           // SVG path data
  name: string;
  color?: string;
  hoverColor?: string;
  animation?: "pulse" | "fill" | "stroke" | "none";
  animationDelay?: number;
  animationDuration?: number;
  data?: Record<string, unknown>;
}

export interface MapMarker {
  id: string;
  x: number;              // Percentage (0-100) or pixel
  y: number;              // Percentage (0-100) or pixel
  label?: string;
  type?: "dot" | "pin" | "flag" | "icon" | "circle";
  color?: string;
  size?: number;
  animation?: "bounce" | "pulse" | "fade" | "slide" | "none";
  animationDelay?: number;
  animationDuration?: number;
}

export interface AnimatedMapProps {
  /** SVG map content (path elements with data-region-id) */
  mapSvg: React.ReactElement<SVGProps<SVGSVGElement>>;
  /** Regions to highlight */
  regions?: MapRegion[];
  /** Markers to place on map */
  markers?: MapMarker[];
  /** ViewBox of the SVG map */
  viewBox?: string;
  /** Width of map */
  width?: number;
  /** Height of map */
  height?: number;
  /** Background color */
  backgroundColor?: string;
  /** Default region color */
  defaultRegionColor?: string;
  /** Highlighted region color */
  highlightColor?: string;
  /** Stroke color for regions */
  strokeColor?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Enable pan/zoom animation */
  camera?: {
    x: number;      // Center X (0-1)
    y: number;      // Center Y (0-1)
    zoom: number;   // Zoom level (1 = fit)
    duration?: number;
  };
}

export const AnimatedMap: FC<AnimatedMapProps> = ({
  mapSvg,
  regions = [],
  markers = [],
  viewBox = "0 0 1920 1080",
  width = 1920,
  height = 1080,
  backgroundColor = "#f5f0e8",
  defaultRegionColor = "#d4c4b0",
  highlightColor = "#c0392b",
  strokeColor = "#8b7355",
  strokeWidth = 1,
  camera,
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  // Build region lookup
  const regionMap = new Map(regions.map(r => [r.id, r]));

  // Calculate camera transform
  let transform = "";
  if (camera) {
    const camProgress = camera.duration
      ? Math.min(1, frame / camera.duration)
      : 1;
    const zoom = interpolate(camProgress, [0, 1], [1, camera.zoom], {
      easing: Easing.out(Easing.quad),
    });
    const cx = width * camera.x;
    const cy = height * camera.y;
    transform = `translate(${-cx * (zoom - 1)}px, ${-cy * (zoom - 1)}px) scale(${zoom})`;
  }

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor,
        overflow: "hidden",
        position: "relative",
        transform,
        transformOrigin: "center center",
      }}
    >
      {/* Base Map SVG */}
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {React.cloneElement(mapSvg as any, {
          viewBox,
          style: {
            width: "100%",
            height: "100%",
            display: "block",
          },
        })}
      </div>

      {/* Region Highlights (overlay) */}
      {regions.map((region) => {
        const animDelay = region.animationDelay || 0;
        const animDuration = region.animationDuration || 60;
        const animProgress = Math.min(1, Math.max(0, (frame - animDelay) / animDuration));

        let opacity = 1;
        let fillColor = region.color || highlightColor;
        let currentStrokeWidth = strokeWidth;

        switch (region.animation) {
          case "pulse":
            opacity = interpolate(animProgress, [0, 0.5, 1], [0.3, 1, 0.3], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            break;
          case "fill":
            opacity = interpolate(animProgress, [0, 1], [0, 1], {
              easing: Easing.out(Easing.quad),
            });
            break;
          case "stroke":
            currentStrokeWidth = interpolate(animProgress, [0, 1], [0, 4], {
              easing: Easing.out(Easing.quad),
            });
            fillColor = "transparent";
            break;
        }

        return (
          <path
            key={region.id}
            d={region.path}
            fill={fillColor}
            stroke={region.animation === "stroke" ? highlightColor : strokeColor}
            strokeWidth={currentStrokeWidth}
            opacity={opacity}
            style={{
              pointerEvents: "none",
              vectorEffect: "non-scaling-stroke",
            }}
          />
        );
      })}

      {/* Markers */}
      {markers.map((marker) => {
        const animDelay = marker.animationDelay || 0;
        const animDuration = marker.animationDuration || 30;
        const animProgress = Math.min(1, Math.max(0, (frame - animDelay) / animDuration));

        const x = marker.x <= 1 ? marker.x * width : marker.x;
        const y = marker.y <= 1 ? marker.y * height : marker.y;
        const size = marker.size || 12;
        const color = marker.color || "#e74c3c";

        let markerTransform = `translate(${x}px, ${y}px)`;
        let markerOpacity = 1;
        let markerScale = 1;

        switch (marker.animation) {
          case "bounce":
            markerScale = interpolate(animProgress, [0, 0.5, 1], [0, 1.3, 1], {
              easing: Easing.out(Easing.back(3)),
            });
            break;
          case "pulse":
            markerScale = interpolate(animProgress, [0, 0.5, 1], [0.8, 1.2, 0.8], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            break;
          case "fade":
            markerOpacity = interpolate(animProgress, [0, 1], [0, 1], {
              easing: Easing.out(Easing.quad),
            });
            break;
          case "slide":
            markerTransform = `translate(${interpolate(animProgress, [0, 1], [x - 50, x], { easing: Easing.out(Easing.cubic) })}px, ${y}px)`;
            markerOpacity = interpolate(animProgress, [0, 1], [0, 1], {
              easing: Easing.out(Easing.quad),
            });
            break;
        }

        return (
          <div
            key={marker.id}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `${markerTransform} scale(${markerScale})`,
              transformOrigin: "center center",
              opacity: markerOpacity,
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            {renderMarker(marker.type || "dot", size, color, marker.label)}
          </div>
        );
      })}
    </div>
  );
};

function renderMarker(type: string, size: number, color: string, label?: string) {
  const halfSize = size / 2;

  switch (type) {
    case "dot":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={halfSize}
            cy={halfSize}
            r={halfSize - 1}
            fill={color}
            stroke="#fff"
            strokeWidth={2}
          />
        </svg>
      );
    case "pin":
      return (
        <svg width={size} height={size * 1.5} viewBox={`0 0 ${size} ${size * 1.5}`}>
          <path
            d={`M${halfSize},${size * 1.5} C${halfSize},${size * 1.5} ${halfSize},${halfSize} ${halfSize},${halfSize} C${halfSize},${halfSize * 0.3} ${size * 0.7},0 ${halfSize},0 C${size * 0.3},0 0,${halfSize * 0.3} 0,${halfSize} C0,${halfSize} 0,${size * 1.5} ${halfSize},${size * 1.5} Z`}
            fill={color}
            stroke="#fff"
            strokeWidth={2}
          />
          <circle cx={halfSize} cy={halfSize} r={halfSize * 0.4} fill="#fff" />
        </svg>
      );
    case "flag":
      return (
        <svg width={size * 1.5} height={size * 1.2} viewBox={`0 0 ${size * 1.5} ${size * 1.2}`}>
          <rect x={0} y={0} width={size * 1.2} height={size * 0.8} fill={color} rx={1} />
          <rect x={size * 1.2 - 2} y={0} width={2} height={size * 1.2} fill="#333" />
          {label && (
            <text
              x={size * 0.6}
              y={size * 0.5}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fff"
              fontSize={size * 0.35}
              fontWeight="bold"
            >
              {label}
            </text>
          )}
        </svg>
      );
    case "circle":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={halfSize}
            cy={halfSize}
            r={halfSize - 2}
            fill="none"
            stroke={color}
            strokeWidth={3}
          />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={halfSize} cy={halfSize} r={halfSize - 1} fill={color} />
        </svg>
      );
  }
}

/**
 * AnimatedArrow - Draws an animated arrow between two points
 */
export interface ArrowProps {
  /** Start point */
  from: { x: number; y: number };
  /** End point */
  to: { x: number; y: number };
  /** Arrow color */
  color?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Arrowhead size */
  headSize?: number;
  /** Animation: "draw" | "flow" | "pulse" | "none" */
  animation?: "draw" | "flow" | "pulse" | "none";
  /** Animation duration in frames */
  animationDuration?: number;
  /** Animation delay in frames */
  animationDelay?: number;
  /** Dash pattern for flow animation */
  dashPattern?: string;
  /** Curve control point for curved arrows */
  curve?: { x: number; y: number };
  /** Label text */
  label?: string;
  /** Label position (0-1 along path) */
  labelPosition?: number;
  /** Label offset perpendicular to path */
  labelOffset?: number;
}

export const AnimatedArrow: FC<ArrowProps> = ({
  from,
  to,
  color = "#e74c3c",
  strokeWidth = 3,
  headSize = 12,
  animation = "draw",
  animationDuration = 60,
  animationDelay = 0,
  dashPattern = "10,5",
  curve,
  label,
  labelPosition = 0.5,
  labelOffset = 20,
}) => {
  const frame = useCurrentFrame();
  const animProgress = Math.min(1, Math.max(0, (frame - animationDelay) / animationDuration));

  // Calculate path
  let pathData: string;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  if (curve) {
    // Quadratic bezier curve
    pathData = `M${from.x},${from.y} Q${curve.x},${curve.y} ${to.x},${to.y}`;
  } else {
    pathData = `M${from.x},${from.y} L${to.x},${to.y}`;
  }

  // Calculate arrowhead points
  const headAngle = Math.PI / 6; // 30 degrees
  const headX1 = to.x - headSize * Math.cos(angle - headAngle);
  const headY1 = to.y - headSize * Math.sin(angle - headAngle);
  const headX2 = to.x - headSize * Math.cos(angle + headAngle);
  const headY2 = to.y - headSize * Math.sin(angle + headAngle);

  const arrowheadPath = `M${to.x},${to.y} L${headX1},${headY1} M${to.x},${to.y} L${headX2},${headY2}`;

  // Animation styles
  let strokeDasharray = "none";
  let strokeDashoffset = 0;
  let pathOpacity = 1;

  switch (animation) {
    case "draw":
      strokeDasharray = `${distance} ${distance}`;
      strokeDashoffset = distance * (1 - animProgress);
      break;
    case "flow":
      strokeDasharray = dashPattern;
      strokeDashoffset = -frame * 2; // Moving dashes
      break;
    case "pulse":
      pathOpacity = interpolate(animProgress, [0, 0.5, 1], [0.3, 1, 0.3], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      break;
  }

  // Label position along path
  let labelX = from.x + dx * labelPosition;
  let labelY = from.y + dy * labelPosition;

  // Offset perpendicular to path
  const perpX = -dy / distance * labelOffset;
  const perpY = dx / distance * labelOffset;
  labelX += perpX;
  labelY += perpY;

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <path
        d={pathData}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={pathOpacity}
        style={{
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
        }}
      />
      <path
        d={arrowheadPath}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        opacity={pathOpacity}
        style={{
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
        }}
      />
      {label && (
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize={14}
          fontWeight="600"
          fontFamily="'Noto Sans', sans-serif"
          stroke="#fff"
          strokeWidth={3}
          paintOrder="stroke fill"
          opacity={pathOpacity}
        >
          {label}
        </text>
      )}
    </svg>
  );
};

/**
 * Timeline - Animated timeline for historical events
 */
export interface TimelineEvent {
  id: string;
  date: string;           // Display date
  year: number;           // Numeric year for positioning
  title: string;
  description?: string;
  color?: string;
  icon?: React.ReactNode;
}

export interface TimelineProps {
  events: TimelineEvent[];
  /** Year range */
  yearRange: [number, number];
  /** Orientation */
  orientation?: "horizontal" | "vertical";
  /** Width */
  width?: number;
  /** Height */
  height?: number;
  /** Animation duration per event */
  animationDuration?: number;
  /** Stagger delay between events */
  staggerDelay?: number;
  /** Line color */
  lineColor?: string;
  /** Line width */
  lineWidth?: number;
  /** Show year markers */
  showYearMarkers?: boolean;
  /** Year marker interval */
  yearMarkerInterval?: number;
}

export const Timeline: FC<TimelineProps> = ({
  events,
  yearRange,
  orientation = "horizontal",
  width = 1920,
  height = 200,
  animationDuration = 45,
  staggerDelay = 15,
  lineColor = "#8b7355",
  lineWidth = 3,
  showYearMarkers = true,
  yearMarkerInterval = 10,
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const [minYear, maxYear] = yearRange;
  const yearSpan = maxYear - minYear;

  // Sort events by year
  const sortedEvents = [...events].sort((a, b) => a.year - b.year);

  if (orientation === "horizontal") {
    const lineY = height / 2;
    const lineStartX = 100;
    const lineEndX = width - 100;
    const lineLength = lineEndX - lineStartX;

    return (
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          position: "relative",
          overflow: "visible",
        }}
      >
        {/* Timeline line */}
        <svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
          <line
            x1={lineStartX}
            y1={lineY}
            x2={lineStartX + lineLength}
            y2={lineY}
            stroke={lineColor}
            strokeWidth={lineWidth}
            strokeLinecap="round"
          />

          {/* Year markers */}
          {showYearMarkers && Array.from({ length: Math.floor(yearSpan / yearMarkerInterval) + 1 }, (_, i) => {
            const year = minYear + i * yearMarkerInterval;
            const x = lineStartX + (year - minYear) / yearSpan * lineLength;
            return (
              <g key={year}>
                <line
                  x1={x}
                  y1={lineY - 10}
                  x2={x}
                  y2={lineY + 10}
                  stroke={lineColor}
                  strokeWidth={2}
                />
                <text
                  x={x}
                  y={lineY + 25}
                  textAnchor="middle"
                  fontSize={11}
                  fill={lineColor}
                  fontFamily="'Noto Sans', sans-serif"
                >
                  {year}
                </text>
              </g>
            );
          })}

          {/* Events */}
          {sortedEvents.map((event, index) => {
            const eventDelay = index * staggerDelay;
            const animProgress = Math.min(1, Math.max(0, (frame - eventDelay) / animationDuration));

            const x = lineStartX + (event.year - minYear) / yearSpan * lineLength;
            const color = event.color || "#c0392b";

            // Animation: appear from line
            const markerY = interpolate(animProgress, [0, 1], [lineY, lineY - 40], {
              easing: Easing.out(Easing.back(2)),
            });
            const opacity = interpolate(animProgress, [0, 0.3, 1], [0, 0.5, 1], {
              easing: Easing.out(Easing.quad),
            });

            return (
              <g key={event.id} opacity={opacity}>
                {/* Connection line */}
                <line
                  x1={x}
                  y1={lineY}
                  x2={x}
                  y2={markerY + 15}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray="4,4"
                />
                {/* Marker */}
                <circle
                  cx={x}
                  cy={markerY + 15}
                  r={interpolate(animProgress, [0, 1], [0, 8], { easing: Easing.out(Easing.back(2)) })}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={2}
                />
                {/* Date label */}
                <text
                  x={x}
                  y={markerY - 5}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight="600"
                  fill={color}
                  fontFamily="'Noto Sans', sans-serif"
                  stroke="#fff"
                  strokeWidth={3}
                  paintOrder="stroke fill"
                >
                  {event.date}
                </text>
                {/* Title */}
                <text
                  x={x}
                  y={markerY - 22}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight="700"
                  fill="#1a1a1a"
                  fontFamily="'Noto Sans', sans-serif"
                  stroke="#fff"
                  strokeWidth={3}
                  paintOrder="stroke fill"
                >
                  {event.title}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  } else {
    // Vertical timeline
    const lineX = width / 2;
    const lineStartY = 80;
    const lineEndY = height - 80;
    const lineLength = lineEndY - lineStartY;

    return (
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          position: "relative",
          overflow: "visible",
        }}
      >
        <svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
          <line
            x1={lineX}
            y1={lineStartY}
            x2={lineX}
            y2={lineEndY}
            stroke={lineColor}
            strokeWidth={lineWidth}
            strokeLinecap="round"
          />

          {showYearMarkers && Array.from({ length: Math.floor(yearSpan / yearMarkerInterval) + 1 }, (_, i) => {
            const year = minYear + i * yearMarkerInterval;
            const y = lineStartY + (year - minYear) / yearSpan * lineLength;
            return (
              <g key={year}>
                <line
                  x1={lineX - 10}
                  y1={y}
                  x2={lineX + 10}
                  y2={y}
                  stroke={lineColor}
                  strokeWidth={2}
                />
                <text
                  x={lineX + 20}
                  y={y + 4}
                  textAnchor="start"
                  fontSize={11}
                  fill={lineColor}
                  fontFamily="'Noto Sans', sans-serif"
                >
                  {year}
                </text>
              </g>
            );
          })}

          {sortedEvents.map((event, index) => {
            const eventDelay = index * staggerDelay;
            const animProgress = Math.min(1, Math.max(0, (frame - eventDelay) / animationDuration));

            const y = lineStartY + (event.year - minYear) / yearSpan * lineLength;
            const color = event.color || "#c0392b";

            const markerX = interpolate(animProgress, [0, 1], [lineX, lineX + 50], {
              easing: Easing.out(Easing.back(2)),
            });
            const opacity = interpolate(animProgress, [0, 0.3, 1], [0, 0.5, 1]);

            return (
              <g key={event.id} opacity={opacity}>
                <line
                  x1={lineX}
                  y1={y}
                  x2={markerX - 15}
                  y2={y}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray="4,4"
                />
                <circle
                  cx={markerX - 15}
                  cy={y}
                  r={interpolate(animProgress, [0, 1], [0, 8], { easing: Easing.out(Easing.back(2)) })}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={2}
                />
                <text
                  x={markerX}
                  y={y - 10}
                  textAnchor="start"
                  fontSize={12}
                  fontWeight="600"
                  fill={color}
                  fontFamily="'Noto Sans', sans-serif"
                  stroke="#fff"
                  strokeWidth={3}
                  paintOrder="stroke fill"
                >
                  {event.date}
                </text>
                <text
                  x={markerX}
                  y={y + 15}
                  textAnchor="start"
                  fontSize={14}
                  fontWeight="700"
                  fill="#1a1a1a"
                  fontFamily="'Noto Sans', sans-serif"
                  stroke="#fff"
                  strokeWidth={3}
                  paintOrder="stroke fill"
                >
                  {event.title}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }
};

/**
 * LocationLabel - Animated label for map locations
 */
export interface LocationLabelProps {
  x: number;
  y: number;
  text: string;
  /** Animation type */
  animation?: "fade" | "slide" | "scale" | "none";
  /** Animation duration */
  animationDuration?: number;
  /** Animation delay */
  animationDelay?: number;
  /** Label style */
  style?: {
    backgroundColor?: string;
    color?: string;
    padding?: number;
    borderRadius?: number;
    fontSize?: number;
    fontWeight?: string | number;
    fontFamily?: string;
    pointerColor?: string;
    pointerLength?: number;
  };
}

export const LocationLabel: FC<LocationLabelProps> = ({
  x,
  y,
  text,
  animation = "slide",
  animationDuration = 30,
  animationDelay = 0,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const animProgress = Math.min(1, Math.max(0, (frame - animationDelay) / animationDuration));

  const {
    backgroundColor = "rgba(26, 26, 26, 0.9)",
    color = "#fff",
    padding = 8,
    borderRadius = 4,
    fontSize = 14,
    fontWeight = 600,
    fontFamily = "'Noto Sans', sans-serif",
    pointerColor = backgroundColor,
    pointerLength = 12,
  } = style;

  let opacity = 1;
  let transform = "translate(-50%, -100%)";

  switch (animation) {
    case "fade":
      opacity = animProgress;
      break;
    case "slide":
      opacity = animProgress;
      transform = `translate(-50%, ${interpolate(animProgress, [0, 1], [-50, -100], { easing: Easing.out(Easing.cubic) })}%)`;
      break;
    case "scale":
      opacity = animProgress;
      transform = `translate(-50%, -100%) scale(${interpolate(animProgress, [0, 1], [0.5, 1], { easing: Easing.out(Easing.back(2)) })})`;
      break;
  }

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        transform,
        transformOrigin: "center bottom",
        opacity,
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      <div
        style={{
          backgroundColor,
          color,
          padding: `${padding}px ${padding * 1.5}px`,
          borderRadius: `${borderRadius}px`,
          fontSize: `${fontSize}px`,
          fontWeight,
          fontFamily,
          whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        {text}
      </div>
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: `${pointerLength / 2}px solid transparent`,
          borderRight: `${pointerLength / 2}px solid transparent`,
          borderTop: `${pointerLength}px solid ${pointerColor}`,
          marginLeft: `-${pointerLength / 2}px`,
        }}
      />
    </div>
  );
};