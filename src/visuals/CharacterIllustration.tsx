import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  AbsoluteFill,
} from "remotion";
import { CSSProperties, FC } from "react";

/**
 * SimpleCharacter - Procedural character illustration for documentaries
 * Renders a simple, stylized character using SVG shapes
 */
export interface SimpleCharacterProps {
  /** Character type */
  type?: "person" | "leader" | "soldier" | "civilian" | "historical";
  /** Character pose */
  pose?: "standing" | "sitting" | "walking" | "speaking" | "gesturing" | "thinking";
  /** Facing direction */
  facing?: "left" | "right" | "front";
  /** Skin tone */
  skinTone?: string;
  /** Hair color */
  hairColor?: string;
  /** Outfit color */
  outfitColor?: string;
  /** Outfit style */
  outfitStyle?: "modern" | "historical" | "military" | "formal" | "casual";
  /** Size multiplier */
  scale?: number;
  /** Animation */
  animation?: "idle" | "breathe" | "talk" | "gesture" | "walk" | "none";
  /** Animation speed */
  animationSpeed?: number;
  /** Show shadow */
  showShadow?: boolean;
  /** Custom style */
  style?: CSSProperties;
}

const defaultSkinTones = ["#FDBCB4", "#F1C27D", "#E0AC69", "#C68642", "#8D5524", "#5D3A1A"];
const defaultHairColors = ["#1a1a1a", "#2c1b0e", "#3d2b1f", "#8b4513", "#a0522d", "#d2691e"];
const defaultOutfitColors = ["#1a3a5c", "#2c3e50", "#3d5a6c", "#5d4e37", "#6b4423", "#8b6914"];

export const SimpleCharacter: FC<SimpleCharacterProps> = ({
  type = "person",
  pose = "standing",
  facing = "front",
  skinTone = defaultSkinTones[2],
  hairColor = defaultHairColors[0],
  outfitColor = defaultOutfitColors[0],
  outfitStyle = "modern",
  scale = 1,
  animation = "idle",
  animationSpeed = 1,
  showShadow = true,
  style = {},
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const time = frame / fps * animationSpeed;

  const s = scale;
  const baseHeight = 300 * s;
  const baseWidth = 180 * s;

  // Animation parameters
  const breatheOffset = animation === "breathe" || animation === "idle"
    ? Math.sin(time * 2) * 3 * s
    : 0;

  const talkOffset = animation === "talk"
    ? Math.sin(time * 8) * 4 * s
    : 0;

  const gestureOffset = animation === "gesture"
    ? Math.sin(time * 1.5) * 15 * s
    : 0;

  const walkCycle = animation === "walk"
    ? Math.sin(time * 4)
    : 0;

  // Head
  const headRadius = 50 * s;
  const headY = 60 * s + breatheOffset;

  // Body proportions
  const neckY = headY + headRadius + 5 * s;
  const shoulderY = neckY + 15 * s;
  const torsoHeight = 90 * s;
  const hipY = shoulderY + torsoHeight;
  const legLength = 90 * s;
  const footY = hipY + legLength;

  // Arm positions based on pose
  let leftArmAngle = -0.3;
  let rightArmAngle = 0.3;
  let leftElbowAngle = 0.5;
  let rightElbowAngle = -0.5;

  switch (pose) {
    case "speaking":
    case "gesturing":
      leftArmAngle = -0.8 + gestureOffset * 0.01;
      rightArmAngle = 0.2;
      leftElbowAngle = 0.2;
      break;
    case "thinking":
      leftArmAngle = -0.2;
      rightArmAngle = -0.8;
      rightElbowAngle = 0.8;
      break;
    case "walking":
      leftArmAngle = -0.5 * walkCycle;
      rightArmAngle = 0.5 * walkCycle;
      leftElbowAngle = 0.3 * walkCycle;
      rightElbowAngle = -0.3 * walkCycle;
      break;
    case "sitting":
      leftArmAngle = 0.2;
      rightArmAngle = -0.2;
      break;
  }

  // Facing direction transforms
  const scaleX = facing === "left" ? -1 : facing === "right" ? 1 : 1;
  const faceOffsetX = facing === "left" ? -8 * s : facing === "right" ? 8 * s : 0;

  const shadowStyle: CSSProperties = showShadow ? {
    position: "absolute",
    bottom: `${10 * s}px`,
    left: `${(baseWidth / 2 - 60 * s) * scaleX}px`,
    width: `${120 * s}px`,
    height: `${15 * s}px`,
    background: "rgba(0,0,0,0.15)",
    borderRadius: "50%",
    filter: "blur(3px)",
    transform: `scaleX(${scaleX})`,
    pointerEvents: "none",
    zIndex: -1,
  } : {};

  return (
    <AbsoluteFill
      style={{
        width: `${baseWidth}px`,
        height: `${baseHeight + 20 * s}px`,
        position: "relative",
        transform: `scaleX(${scaleX})`,
        transformOrigin: "center bottom",
        ...style,
      }}
    >
      {showShadow && <div style={shadowStyle} />}

      <svg
        width={baseWidth}
        height={baseHeight + 20 * s}
        viewBox={`0 0 ${baseWidth} ${baseHeight + 20 * s}`}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      >
        {/* Legs */}
        <g stroke={outfitColor} strokeWidth={Math.max(1, 20 * s)} strokeLinecap="round" fill="none">
          {/* Left leg */}
          <path
            d={legPath(
              baseWidth / 2 - 15 * s,
              hipY,
              baseWidth / 2 - 15 * s + walkCycle * 10 * s,
              footY + (walkCycle > 0 ? -10 * s : 0),
              walkCycle > 0 ? 0.3 : 0
            )}
          />
          {/* Right leg */}
          <path
            d={legPath(
              baseWidth / 2 + 15 * s,
              hipY,
              baseWidth / 2 + 15 * s - walkCycle * 10 * s,
              footY + (walkCycle < 0 ? -10 * s : 0),
              walkCycle < 0 ? 0.3 : 0
            )}
          />
        </g>

        {/* Torso */}
        <path
          d={torsoPath(baseWidth / 2, shoulderY, torsoHeight, hipY, outfitColor)}
          fill={outfitColor}
          stroke={darken(outfitColor, 20)}
          strokeWidth={Math.max(1, 2 * s)}
        />

        {/* Arms */}
        <g stroke={outfitColor} strokeWidth={Math.max(1, 16 * s)} strokeLinecap="round" fill="none">
          {/* Left arm */}
          <path
            d={armPath(
              baseWidth / 2 - 2 * s,
              shoulderY + 10 * s,
              leftArmAngle,
              leftElbowAngle,
              60 * s
            )}
          />
          {/* Right arm */}
          <path
            d={armPath(
              baseWidth / 2 + 2 * s,
              shoulderY + 10 * s,
              rightArmAngle,
              rightElbowAngle,
              60 * s
            )}
          />
        </g>

        {/* Hands */}
        <circle
          cx={baseWidth / 2 - 2 * s + Math.cos(leftArmAngle + leftElbowAngle) * 60 * s + Math.cos(leftArmAngle) * 25 * s}
          cy={shoulderY + 10 * s + Math.sin(leftArmAngle) * 25 * s + Math.sin(leftArmAngle + leftElbowAngle) * 35 * s}
          r={8 * s}
          fill={skinTone}
        />
        <circle
          cx={baseWidth / 2 + 2 * s + Math.cos(rightArmAngle + rightElbowAngle) * 60 * s + Math.cos(rightArmAngle) * 25 * s}
          cy={shoulderY + 10 * s + Math.sin(rightArmAngle) * 25 * s + Math.sin(rightArmAngle + rightElbowAngle) * 35 * s}
          r={8 * s}
          fill={skinTone}
        />

        {/* Neck */}
        <rect
          x={baseWidth / 2 - 12 * s}
          y={neckY}
          width={24 * s}
          height={15 * s}
          fill={skinTone}
        />

        {/* Head */}
        <circle
          cx={baseWidth / 2 + faceOffsetX}
          cy={headY}
          r={headRadius}
          fill={skinTone}
          stroke={darken(skinTone, 15)}
          strokeWidth={Math.max(1, 1 * s)}
        />

        {/* Hair */}
        {renderHair(baseWidth / 2 + faceOffsetX, headY, headRadius, hairColor, type, s)}

        {/* Face features */}
        <g fill={darken(skinTone, 30)}>
          {/* Eyes */}
          <ellipse
            cx={baseWidth / 2 - 14 * s + faceOffsetX}
            cy={headY - 5 * s}
            rx={6 * s}
            ry={4 * s}
          />
          <ellipse
            cx={baseWidth / 2 + 14 * s + faceOffsetX}
            cy={headY - 5 * s}
            rx={6 * s}
            ry={4 * s}
          />
          {/* Pupils */}
          <ellipse
            cx={baseWidth / 2 - 14 * s + faceOffsetX + (facing === "left" ? -2 : facing === "right" ? 2 : 0) * s}
            cy={headY - 5 * s}
            rx={2.5 * s}
            ry={3 * s}
            fill="#1a1a1a"
          />
          <ellipse
            cx={baseWidth / 2 + 14 * s + faceOffsetX + (facing === "left" ? -2 : facing === "right" ? 2 : 0) * s}
            cy={headY - 5 * s}
            rx={2.5 * s}
            ry={3 * s}
            fill="#1a1a1a"
          />
          {/* Eyebrows */}
          <path
            d={`M${baseWidth / 2 - 20 * s + faceOffsetX},${headY - 18 * s} Q${baseWidth / 2 - 14 * s + faceOffsetX},${headY - 22 * s} ${baseWidth / 2 - 8 * s + faceOffsetX},${headY - 18 * s}`}
            stroke={darken(hairColor, 20)}
            strokeWidth={Math.max(1, 2 * s)}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`M${baseWidth / 2 + 8 * s + faceOffsetX},${headY - 18 * s} Q${baseWidth / 2 + 14 * s + faceOffsetX},${headY - 22 * s} ${baseWidth / 2 + 20 * s + faceOffsetX},${headY - 18 * s}`}
            stroke={darken(hairColor, 20)}
            strokeWidth={Math.max(1, 2 * s)}
            fill="none"
            strokeLinecap="round"
          />
          {/* Nose */}
          <path
            d={`M${baseWidth / 2 + faceOffsetX},${headY - 2 * s} L${baseWidth / 2 + 4 * s + faceOffsetX},${headY + 6 * s}`}
            stroke={darken(skinTone, 25)}
            strokeWidth={Math.max(1, 1.5 * s)}
            fill="none"
            strokeLinecap="round"
          />
          {/* Mouth */}
          <path
            d={mouthPath(baseWidth / 2 + faceOffsetX, headY + 12 * s, talkOffset, s)}
            stroke={darken(skinTone, 35)}
            strokeWidth={Math.max(1, 2 * s)}
            fill="none"
            strokeLinecap="round"
          />
        </g>

        {/* Outfit details */}
        {renderOutfitDetails(baseWidth / 2, shoulderY, hipY, outfitColor, outfitStyle, type, s)}
      </svg>
    </AbsoluteFill>
  );
};

function legPath(hipX: number, hipY: number, kneeX: number, footY: number, bend: number): string {
  const kneeY = hipY + (footY - hipY) * 0.5 + bend * 20;
  return `M${hipX},${hipY} Q${kneeX},${kneeY} ${kneeX},${footY}`;
}

function armPath(shoulderX: number, shoulderY: number, upperAngle: number, elbowAngle: number, length: number): string {
  const elbowX = shoulderX + Math.cos(upperAngle) * length * 0.45;
  const elbowY = shoulderY + Math.sin(upperAngle) * length * 0.45;
  const wristX = elbowX + Math.cos(upperAngle + elbowAngle) * length * 0.55;
  const wristY = elbowY + Math.sin(upperAngle + elbowAngle) * length * 0.55;
  return `M${shoulderX},${shoulderY} Q${elbowX},${elbowY} ${wristX},${wristY}`;
}

function torsoPath(cx: number, shoulderY: number, height: number, hipY: number, color: string): string {
  const shoulderWidth = 60;
  const hipWidth = 45;
  return `M${cx - shoulderWidth / 2},${shoulderY}
    L${cx + shoulderWidth / 2},${shoulderY}
    L${cx + hipWidth / 2},${hipY}
    L${cx - hipWidth / 2},${hipY}
    Z`;
}

function mouthPath(cx: number, cy: number, talkOffset: number, s: number): string {
  if (talkOffset > 2) {
    return `M${cx - 8 * s},${cy} Q${cx},${cy + 6 * s + talkOffset} ${cx + 8 * s},${cy}`;
  }
  return `M${cx - 6 * s},${cy} Q${cx},${cy + 2 * s} ${cx + 6 * s},${cy}`;
}

function renderHair(cx: number, headY: number, radius: number, color: string, type: string, s: number) {
  const hairTop = headY - radius;
  const hairWidth = radius * 1.3;

  return (
    <g fill={color}>
      {/* Main hair */}
      <path
        d={`M${cx - hairWidth},${hairTop + radius * 0.3}
          Q${cx - hairWidth * 0.5},${hairTop - radius * 0.2} ${cx},${hairTop - radius * 0.4}
          Q${cx + hairWidth * 0.5},${hairTop - radius * 0.2} ${cx + hairWidth},${hairTop + radius * 0.3}
          Q${cx + hairWidth * 0.8},${headY + radius * 0.5} ${cx},${headY + radius * 0.9}
          Q${cx - hairWidth * 0.8},${headY + radius * 0.5} ${cx - hairWidth},${hairTop + radius * 0.3}
          Z`}
      />
      {/* Forehead hair */}
      {type !== "leader" && type !== "historical" && (
        <path
          d={`M${cx - hairWidth * 0.6},${hairTop + radius * 0.4}
            Q${cx - hairWidth * 0.3},${hairTop - radius * 0.1} ${cx},${hairTop + radius * 0.1}
            Q${cx + hairWidth * 0.3},${hairTop - radius * 0.1} ${cx + hairWidth * 0.6},${hairTop + radius * 0.4}
            Z`}
          fill={darken(color, 10)}
        />
      )}
    </g>
  );
}

function renderOutfitDetails(
  cx: number,
  shoulderY: number,
  hipY: number,
  color: string,
  style: string,
  type: string,
  s: number
) {
  const darker = darken(color, 20);
  const lighter = lighten(color, 15);

  return (
    <g>
      {/* Collar */}
      {style === "formal" && (
        <path
          d={`M${cx - 25 * s},${shoulderY} L${cx},${shoulderY - 15 * s} L${cx + 25 * s},${shoulderY}`}
          fill={lighter}
          stroke={darker}
          strokeWidth={1 * s}
        />
      )}

      {/* Buttons */}
      {style === "formal" || style === "military" ? (
        Array.from({ length: 4 }, (_, i) => (
          <circle
            key={i}
            cx={cx + (style === "military" ? 0 : 8 * s)}
            cy={shoulderY + 25 * s + i * 15 * s}
            r={3 * s}
            fill={style === "military" ? "#FFD700" : lighter}
          />
        ))
      ) : null}

      {/* Belt */}
      {style !== "casual" && (
        <rect
          x={cx - 30 * s}
          y={hipY - 5 * s}
          width={60 * s}
          height={6 * s}
          fill={darker}
        />
      )}

      {/* Epaulettes for military */}
      {style === "military" && (
        <>
          <ellipse
            cx={cx - 35 * s}
            cy={shoulderY + 5 * s}
            rx={12 * s}
            ry={5 * s}
            fill="#FFD700"
            stroke={darker}
            strokeWidth={1 * s}
          />
          <ellipse
            cx={cx + 35 * s}
            cy={shoulderY + 5 * s}
            rx={12 * s}
            ry={5 * s}
            fill="#FFD700"
            stroke={darker}
            strokeWidth={1 * s}
          />
        </>
      )}

      {/* Robe for historical */}
      {style === "historical" && (
        <path
          d={`M${cx - 40 * s},${shoulderY + 20 * s}
            Q${cx - 50 * s},${shoulderY + 50 * s} ${cx - 45 * s},${hipY}
            L${cx + 45 * s},${hipY}
            Q${cx + 50 * s},${shoulderY + 50 * s} ${cx + 40 * s},${shoulderY + 20 * s}
            Z`}
          fill={color}
          stroke={darker}
          strokeWidth={1 * s}
          opacity={0.3}
        />
      )}
    </g>
  );
}

function darken(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent));
  const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(2.55 * percent));
  const b = Math.max(0, (num & 0x0000FF) - Math.round(2.55 * percent));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

function lighten(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + Math.round(2.55 * percent));
  const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round(2.55 * percent));
  const b = Math.min(255, (num & 0x0000FF) + Math.round(2.55 * percent));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

/**
 * CharacterGroup - Multiple characters in a scene
 */
export interface CharacterGroupProps {
  characters: Array<{
    props: SimpleCharacterProps;
    x: number;
    y: number;
    zIndex?: number;
  }>;
}

export const CharacterGroup: FC<CharacterGroupProps> = ({ characters }) => {
  return (
    <AbsoluteFill>
      {characters.map(({ props, x, y, zIndex = 0 }, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${x}px`,
            top: `${y}px`,
            zIndex,
            pointerEvents: "none",
          }}
        >
          <SimpleCharacter {...props} />
        </div>
      ))}
    </AbsoluteFill>
  );
};