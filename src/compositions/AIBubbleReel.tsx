import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";

export interface CueItem {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
  startFrame: number;
  endFrame: number;
}

export interface AIBubbleReelProps {
  narrationSrc?: string;
  musicSrc?: string;
  subtitlesData?: { cues: CueItem[] };
}

// Convert time to frames at 30fps
const toFrames = (seconds: number) => Math.round(seconds * 30);

export const AIBubbleReel: React.FC<AIBubbleReelProps> = ({
  narrationSrc = "/audio/ai_bubble_mastered.wav",
  musicSrc = "/audio/bgm/tech_cyber.wav",
  subtitlesData = { cues: [] },
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Find active subtitle cue
  const activeCue = subtitlesData.cues.find(
    (c) => frame >= c.startFrame && frame < c.endFrame
  );

  // Fast cut scene boundaries based on Whisper timestamps
  // Scene 1: 0 - 130 (0 - 4.32s)
  // Scene 2: 130 - 274 (4.32 - 9.12s)
  // Scene 3: 274 - 389 (9.12 - 12.96s)
  // Scene 4: 389 - 470 (12.96 - 15.68s)
  // Scene 5: 470 - 595 (15.68 - 19.84s)
  // Scene 6: 595 - 679 (19.84 - 22.64s)
  // Scene 7: 679 - 854 (22.64 - 28.48s)
  // Scene 8: 854 - 1010 (28.48 - 33.68s)
  // Scene 9: 1010 - 1178 (33.68 - 39.28s)
  // Scene 10: 1178 - 1279 (39.28 - 42.64s)
  // Scene 11: 1279 - 1428 (42.64 - 47.60s)
  // Scene 12: 1428 - 1572 (47.60 - 52.40s)

  // Cut flash strobe at scene transitions
  const cutFrames = [0, 130, 274, 389, 470, 595, 679, 854, 1010, 1178, 1279, 1428];
  let isFlash = false;
  let framesSinceCut = 0;
  for (const cf of cutFrames) {
    if (frame >= cf && frame < cf + 4) {
      isFlash = true;
      framesSinceCut = frame - cf;
      break;
    }
  }

  // Camera punch-in scale on cuts
  const punchScale = isFlash ? 1.08 - framesSinceCut * 0.02 : 1.0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#06080F",
        fontFamily: "'Inter', -apple-system, sans-serif",
        color: "#FFFFFF",
        overflow: "hidden",
        transform: `scale(${punchScale})`,
      }}
    >
      {/* Audio Layer: Mastered Voice + Ducked Cyber Beat */}
      {narrationSrc && <Audio src={staticFile(narrationSrc)} volume={1.0} />}
      {musicSrc && (
        <Audio
          src={staticFile(musicSrc)}
          volume={(f) => {
            if (f < 15) return interpolate(f, [0, 15], [0, 0.18]);
            if (f > 1540) return interpolate(f, [1540, 1572], [0.18, 0]);
            return 0.16;
          }}
        />
      )}

      {/* Cyber Grid Background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0, 229, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 229, 255, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          opacity: 0.8,
        }}
      />

      {/* Dynamic Background Glow */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: frame < 470
            ? "radial-gradient(circle, rgba(255, 30, 80, 0.22) 0%, transparent 70%)"
            : frame < 1010
            ? "radial-gradient(circle, rgba(255, 120, 0, 0.2) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(0, 229, 255, 0.22) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* TOP HUD BAR (Mobile Safe Area Header) */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 50,
          right: 50,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "#FF1744",
              boxShadow: "0 0 10px #FF1744",
              opacity: frame % 30 < 15 ? 1 : 0.4,
            }}
          />
          <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: 3, color: "#FF1744" }}>
            MARKET ALERT
          </span>
          <span style={{ fontSize: 20, color: "#94A3B8", letterSpacing: 1 }}>
            // TECH COLLAPSE DESK
          </span>
        </div>

        {/* Dynamic Audio Visualizer Meter */}
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 26 }}>
          {[18, 24, 14, 26, 20, 28, 16, 22].map((baseH, idx) => {
            const h = 6 + Math.abs(Math.sin((frame * 0.2) + idx)) * baseH;
            return (
              <div
                key={idx}
                style={{
                  width: 5,
                  height: h,
                  backgroundColor: "#00E5FF",
                  borderRadius: 2,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* ===================== SCENE GRAPH ===================== */}

      {/* SCENE 1 (Frames 0 - 130): THE TRILLION DOLLAR CRACK */}
      {frame >= 0 && frame < 130 && (
        <SceneCrashHook frame={frame} />
      )}

      {/* SCENE 2 (Frames 130 - 274): SILICON VALLEY BRUTAL REALITY */}
      {frame >= 130 && frame < 274 && (
        <SceneSiliconValley frame={frame - 130} />
      )}

      {/* SCENE 3 (Frames 274 - 389): ANTHROPIC & CLAUDE PRIVATE SHARES */}
      {frame >= 274 && frame < 389 && (
        <SceneAnthropicLoss frame={frame - 274} />
      )}

      {/* SCENE 4 (Frames 389 - 470): BLEEDING BILLIONS IN COMPUTE */}
      {frame >= 389 && frame < 470 && (
        <SceneComputeBleed frame={frame - 389} />
      )}

      {/* SCENE 5 (Frames 470 - 595): ASTRONOMICAL STARTUP VALUATIONS */}
      {frame >= 470 && frame < 595 && (
        <SceneStartupValuations frame={frame - 470} />
      )}

      {/* SCENE 6 (Frames 595 - 679): THE INFINITE GROWTH ILLUSION */}
      {frame >= 595 && frame < 679 && (
        <SceneInfiniteGrowth frame={frame - 595} />
      )}

      {/* SCENE 7 (Frames 679 - 854): CAPEX VS REVENUE RECKONING */}
      {frame >= 679 && frame < 854 && (
        <SceneCapexVsRevenue frame={frame - 679} />
      )}

      {/* SCENE 8 (Frames 854 - 1010): SECONDARY MARKET 40% HAIRCUT */}
      {frame >= 854 && frame < 1010 && (
        <SceneSecondaryMarket frame={frame - 854} />
      )}

      {/* SCENE 9 (Frames 1010 - 1178): THE TRILLION DOLLAR PROFIT QUESTION */}
      {frame >= 1010 && frame < 1178 && (
        <SceneProfitQuestion frame={frame - 1010} />
      )}

      {/* SCENE 10 (Frames 1178 - 1279): THE GOLD RUSH HYPE */}
      {frame >= 1178 && frame < 1279 && (
        <SceneGoldRush frame={frame - 1178} />
      )}

      {/* SCENE 11 (Frames 1279 - 1428): SHAKEOUT OF SURVIVORS */}
      {frame >= 1279 && frame < 1428 && (
        <SceneShakeout frame={frame - 1279} />
      )}

      {/* SCENE 12 (Frames 1428 - 1572): BURST OR GREAT RESET? OUTRO */}
      {frame >= 1428 && (
        <SceneResetOutro frame={frame - 1428} />
      )}

      {/* CUT TRANSITION FLASH */}
      {isFlash && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#FFFFFF",
            opacity: 0.35 - framesSinceCut * 0.08,
            pointerEvents: "none",
            zIndex: 90,
          }}
        />
      )}

      {/* VIGNETTE & FILM OVERLAY */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 160px rgba(0,0,0,0.85)",
          pointerEvents: "none",
          zIndex: 80,
        }}
      />

      {/* KINETIC CLOSED CAPTIONS (MOBILE SAFE ZONE: BOTTOM 240px) */}
      <div
        style={{
          position: "absolute",
          bottom: 230,
          left: 50,
          right: 50,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          zIndex: 100,
        }}
      >
        {activeCue && (
          <div
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.88)",
              border: "2px solid rgba(255, 230, 0, 0.6)",
              borderRadius: 18,
              padding: "16px 28px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.9), 0 0 25px rgba(255, 230, 0, 0.25)",
              transform: `scale(${1 + Math.sin(frame * 0.4) * 0.02})`,
            }}
          >
            <span
              style={{
                fontSize: 44,
                fontWeight: 900,
                color: "#FFE600",
                textTransform: "uppercase",
                letterSpacing: 1.5,
                textShadow: "0 0 15px rgba(255, 230, 0, 0.8), 0 4px 10px rgba(0,0,0,1)",
                lineHeight: 1.25,
              }}
            >
              {activeCue.text}
            </span>
          </div>
        )}
      </div>

      {/* BOTTOM TICKER HUD */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 60,
          right: 60,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 20,
          color: "#64748B",
          borderTop: "1px solid rgba(148, 163, 184, 0.2)",
          paddingTop: 16,
          zIndex: 70,
        }}
      >
        <span>NASDAQ: TECH VOLATILITY INDEX 48.2</span>
        <span style={{ color: "#FF1744", fontWeight: 700 }}>AI VALUATIONS ▼ -40%</span>
      </div>
    </AbsoluteFill>
  );
};

// =================== SCENE COMPONENTS =================== //

// 1. Scene Crash Hook
const SceneCrashHook: React.FC<{ frame: number }> = ({ frame }) => {
  const chartDrop = interpolate(frame, [10, 80], [0, 240], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 280, left: 60, right: 60, textAlign: "center" }}>
      <div
        style={{
          display: "inline-block",
          padding: "8px 24px",
          backgroundColor: "#FF1744",
          color: "#FFF",
          fontWeight: 900,
          fontSize: 28,
          borderRadius: 8,
          letterSpacing: 4,
          marginBottom: 24,
          boxShadow: "0 0 30px rgba(255, 23, 68, 0.7)",
        }}
      >
        CRITICAL WARNING
      </div>
      <h1
        style={{
          fontSize: 76,
          fontWeight: 900,
          lineHeight: 1.05,
          letterSpacing: -1,
          margin: "0 0 20px",
          textShadow: "0 10px 40px rgba(0,0,0,0.8)",
        }}
      >
        THE $1 TRILLION<br />
        <span style={{ color: "#FF1744" }}>AI BUBBLE</span><br />
        IS CRACKING
      </h1>

      {/* Crashing Stock Chart SVG */}
      <div style={{ marginTop: 40, position: "relative", height: 280 }}>
        <svg width="100%" height="280" viewBox="0 0 960 280" fill="none">
          {/* Grid lines */}
          <line x1="0" y1="70" x2="960" y2="70" stroke="rgba(255,255,255,0.1)" strokeDasharray="5 5" />
          <line x1="0" y1="140" x2="960" y2="140" stroke="rgba(255,255,255,0.1)" strokeDasharray="5 5" />
          <line x1="0" y1="210" x2="960" y2="210" stroke="rgba(255,255,255,0.1)" strokeDasharray="5 5" />

          {/* Crashing Red Curve */}
          <path
            d={`M 40 60 Q 250 40 450 70 T 700 130 L 920 ${60 + chartDrop}`}
            stroke="#FF1744"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
          />
          {/* Peak Dot */}
          <circle cx="450" cy="70" r="10" fill="#00E5FF" />
          {/* Crash Tip */}
          <circle cx="920" cy={60 + chartDrop} r="14" fill="#FF1744" />
        </svg>

        <div
          style={{
            position: "absolute",
            right: 40,
            top: 20 + chartDrop,
            backgroundColor: "#FF1744",
            padding: "8px 18px",
            borderRadius: 8,
            fontWeight: 900,
            fontSize: 26,
            boxShadow: "0 0 20px rgba(255,23,68,0.8)",
          }}
        >
          -42% PLUNGE
        </div>
      </div>
    </div>
  );
};

// 2. Scene Silicon Valley Reality Check
const SceneSiliconValley: React.FC<{ frame: number }> = ({ frame }) => {
  const countVal = Math.round(interpolate(frame, [0, 80], [65, 39], { extrapolateRight: "clamp" }));
  return (
    <div style={{ position: "absolute", top: 320, left: 60, right: 60, textAlign: "center" }}>
      <div style={{ color: "#00E5FF", fontSize: 30, fontWeight: 800, letterSpacing: 3, marginBottom: 16 }}>
        SILICON VALLEY // CLOSED DOORS
      </div>
      <h2 style={{ fontSize: 68, fontWeight: 900, margin: "0 0 40px", lineHeight: 1.1 }}>
        A BRUTAL<br />
        <span style={{ color: "#FF7A00" }}>REALITY CHECK</span>
      </h2>

      {/* VC Valuation Drop Visualizer */}
      <div
        style={{
          background: "rgba(15, 23, 42, 0.8)",
          border: "2px solid rgba(255, 122, 0, 0.5)",
          borderRadius: 24,
          padding: "40px 30px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
        }}
      >
        <div style={{ fontSize: 24, color: "#94A3B8", letterSpacing: 2, marginBottom: 12 }}>
          TOP TIER AI LAB VALUATION INDEX
        </div>
        <div style={{ fontSize: 92, fontWeight: 900, color: "#FF7A00", letterSpacing: -2 }}>
          ${countVal}B
        </div>
        <div style={{ fontSize: 28, color: "#FF1744", fontWeight: 800, marginTop: 10 }}>
          DOWN FROM $65 BILLION PEAK
        </div>
      </div>
    </div>
  );
};

// 3. Scene Anthropic & Claude Share Loss
const SceneAnthropicLoss: React.FC<{ frame: number }> = ({ frame }) => {
  const discount = Math.round(interpolate(frame, [10, 60], [0, 40], { extrapolateRight: "clamp" }));
  return (
    <div style={{ position: "absolute", top: 290, left: 60, right: 60, textAlign: "center" }}>
      <div
        style={{
          display: "inline-block",
          padding: "6px 20px",
          backgroundColor: "#D97706",
          color: "#000",
          fontWeight: 900,
          fontSize: 26,
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        EXCLUSIVE // SECONDARY MARKET
      </div>

      <h2 style={{ fontSize: 72, fontWeight: 900, margin: "0 0 30px", lineHeight: 1.1 }}>
        ANTHROPIC<br />
        <span style={{ color: "#FBBF24" }}>CLAUDE VALUATION</span>
      </h2>

      {/* Secondary Market Card */}
      <div
        style={{
          background: "linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)",
          border: "2px solid #F59E0B",
          borderRadius: 24,
          padding: "36px 30px",
          boxShadow: "0 0 40px rgba(245, 158, 11, 0.25)",
        }}
      >
        <div style={{ fontSize: 24, color: "#CBD5E1", marginBottom: 16 }}>
          PRIVATE TECH EQUITY SELL-OFF
        </div>
        <div style={{ fontSize: 100, fontWeight: 900, color: "#EF4444" }}>
          -{discount}%
        </div>
        <div style={{ fontSize: 28, color: "#FBBF24", fontWeight: 800, marginTop: 8 }}>
          UNPRECEDENTED DISCOUNTS OFFERED
        </div>
      </div>
    </div>
  );
};

// 4. Scene Bleeding Billions in Compute
const SceneComputeBleed: React.FC<{ frame: number }> = ({ frame }) => {
  const burn = interpolate(frame, [0, 50], [1, 10], { extrapolateRight: "clamp" }).toFixed(1);
  return (
    <div style={{ position: "absolute", top: 320, left: 60, right: 60, textAlign: "center" }}>
      <div style={{ color: "#EF4444", fontSize: 28, fontWeight: 800, letterSpacing: 3, marginBottom: 16 }}>
        INFRASTRUCTURE CRISIS
      </div>
      <h2 style={{ fontSize: 70, fontWeight: 900, margin: "0 0 36px", lineHeight: 1.1 }}>
        BLEEDING BILLIONS IN<br />
        <span style={{ color: "#FF1744" }}>COMPUTE COSTS</span>
      </h2>

      <div
        style={{
          background: "rgba(239, 68, 68, 0.12)",
          border: "2px solid #EF4444",
          borderRadius: 24,
          padding: "40px 24px",
        }}
      >
        <div style={{ fontSize: 24, color: "#FCA5A5", letterSpacing: 2, marginBottom: 10 }}>
          ANNUAL GPU CLUSTER CASH BURN
        </div>
        <div style={{ fontSize: 96, fontWeight: 900, color: "#FF1744" }}>
          ${burn}B
        </div>
        <div style={{ fontSize: 26, color: "#CBD5E1", marginTop: 10 }}>
          DATA CENTERS CANNOT SELF-SUSTAIN
        </div>
      </div>
    </div>
  );
};

// 5. Scene Startup Valuations
const SceneStartupValuations: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <div style={{ position: "absolute", top: 320, left: 60, right: 60, textAlign: "center" }}>
      <div style={{ color: "#00E5FF", fontSize: 26, fontWeight: 800, letterSpacing: 2, marginBottom: 16 }}>
        VENTURE CAPITAL FRENZY
      </div>
      <h2 style={{ fontSize: 70, fontWeight: 900, margin: "0 0 40px", lineHeight: 1.1 }}>
        ASTRONOMICAL<br />
        <span style={{ color: "#00E5FF" }}>STARTUP VALUATIONS</span>
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {[
          { label: "SERIES A MEDIAN", mult: "85x REVENUE" },
          { label: "FOUNDATION LABS", mult: "120x REVENUE" },
          { label: "HISTORICAL TECH BUBBLE", mult: "15x REVENUE" },
        ].map((item, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "20px 28px",
              backgroundColor: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(0, 229, 255, 0.3)",
              borderRadius: 14,
              fontSize: 26,
              fontWeight: 800,
            }}
          >
            <span style={{ color: "#CBD5E1" }}>{item.label}</span>
            <span style={{ color: idx === 2 ? "#10B981" : "#FF1744" }}>{item.mult}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// 6. Scene Infinite Growth Illusion
const SceneInfiniteGrowth: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <div style={{ position: "absolute", top: 340, left: 60, right: 60, textAlign: "center" }}>
      <div style={{ color: "#F59E0B", fontSize: 28, fontWeight: 800, letterSpacing: 2, marginBottom: 16 }}>
        THE CORE ASSUMPTION
      </div>
      <h2 style={{ fontSize: 72, fontWeight: 900, margin: "0 0 40px", lineHeight: 1.1 }}>
        BETTING ON<br />
        <span style={{ color: "#FF1744" }}>INFINITE EXPONENTIALS</span>
      </h2>

      <div
        style={{
          padding: "36px 30px",
          backgroundColor: "rgba(15, 23, 42, 0.85)",
          border: "2px dashed #EF4444",
          borderRadius: 20,
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 900, color: "#EF4444", marginBottom: 10 }}>
          GROWTH CEILING HIT
        </div>
        <div style={{ fontSize: 24, color: "#94A3B8" }}>
          Enterprise pilot projects stall before full deployment
        </div>
      </div>
    </div>
  );
};

// 7. Scene Capex vs Revenue Reckoning
const SceneCapexVsRevenue: React.FC<{ frame: number }> = ({ frame }) => {
  const capexHeight = interpolate(frame, [0, 60], [50, 260], { extrapolateRight: "clamp" });
  const revHeight = interpolate(frame, [0, 60], [20, 70], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 280, left: 60, right: 60, textAlign: "center" }}>
      <div style={{ color: "#EF4444", fontSize: 28, fontWeight: 800, letterSpacing: 2, marginBottom: 14 }}>
        FINANCIAL REALITY
      </div>
      <h2 style={{ fontSize: 68, fontWeight: 900, margin: "0 0 36px", lineHeight: 1.1 }}>
        TRAINING EXPLODED<br />
        <span style={{ color: "#F59E0B" }}>REVENUE LAGGING</span>
      </h2>

      {/* Comparison Bars */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          alignItems: "flex-end",
          height: 300,
          padding: "20px 40px",
          background: "rgba(15, 23, 42, 0.8)",
          borderRadius: 20,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#EF4444" }}>$100B</div>
          <div
            style={{
              width: 140,
              height: capexHeight,
              backgroundColor: "#EF4444",
              borderRadius: "8px 8px 0 0",
              boxShadow: "0 0 25px rgba(239, 68, 68, 0.5)",
            }}
          />
          <div style={{ fontSize: 22, fontWeight: 800, color: "#CBD5E1" }}>CAPEX BURN</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#00E5FF" }}>$14B</div>
          <div
            style={{
              width: 140,
              height: revHeight,
              backgroundColor: "#00E5FF",
              borderRadius: "8px 8px 0 0",
              boxShadow: "0 0 25px rgba(0, 229, 255, 0.5)",
            }}
          />
          <div style={{ fontSize: 22, fontWeight: 800, color: "#CBD5E1" }}>ACTUAL REV</div>
        </div>
      </div>
    </div>
  );
};

// 8. Scene Secondary Market Haircut
const SceneSecondaryMarket: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <div style={{ position: "absolute", top: 320, left: 60, right: 60, textAlign: "center" }}>
      <div style={{ color: "#F59E0B", fontSize: 28, fontWeight: 800, letterSpacing: 3, marginBottom: 16 }}>
        LIQUIDITY SQUEEZE
      </div>
      <h2 style={{ fontSize: 72, fontWeight: 900, margin: "0 0 36px", lineHeight: 1.1 }}>
        STAGGERING<br />
        <span style={{ color: "#EF4444" }}>40% HAIRCUT</span>
      </h2>

      <div
        style={{
          padding: "36px",
          background: "rgba(239, 68, 68, 0.15)",
          border: "2px solid #EF4444",
          borderRadius: 24,
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 900, color: "#FFE600", marginBottom: 12 }}>
          INVESTOR VALUATIONS SLASHED
        </div>
        <div style={{ fontSize: 24, color: "#E2E8F0" }}>
          Private shares dumping across secondary exchanges
        </div>
      </div>
    </div>
  );
};

// 9. Scene Profit Question
const SceneProfitQuestion: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <div style={{ position: "absolute", top: 330, left: 60, right: 60, textAlign: "center" }}>
      <div style={{ color: "#00E5FF", fontSize: 28, fontWeight: 800, letterSpacing: 3, marginBottom: 16 }}>
        WALL STREET INQUIRY
      </div>
      <h2
        style={{
          fontSize: 82,
          fontWeight: 900,
          color: "#FFE600",
          lineHeight: 1.05,
          textShadow: "0 0 40px rgba(255, 230, 0, 0.6)",
        }}
      >
        WHEN DOES<br />
        ANYONE MAKE<br />
        A PROFIT?
      </h2>
    </div>
  );
};

// 10. Scene Gold Rush
const SceneGoldRush: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <div style={{ position: "absolute", top: 340, left: 60, right: 60, textAlign: "center" }}>
      <div style={{ color: "#F59E0B", fontSize: 28, fontWeight: 800, letterSpacing: 3, marginBottom: 16 }}>
        HISTORICAL PARALLEL
      </div>
      <h2 style={{ fontSize: 72, fontWeight: 900, margin: "0 0 36px", lineHeight: 1.1 }}>
        THE GOLD RUSH<br />
        <span style={{ color: "#F59E0B" }}>OVERNIGHT HYPE</span>
      </h2>
      <div style={{ fontSize: 30, color: "#94A3B8" }}>
        Just like the dot-com era, hype runs 5 years ahead of reality
      </div>
    </div>
  );
};

// 11. Scene Shakeout
const SceneShakeout: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <div style={{ position: "absolute", top: 310, left: 60, right: 60, textAlign: "center" }}>
      <div style={{ color: "#EF4444", fontSize: 28, fontWeight: 800, letterSpacing: 3, marginBottom: 16 }}>
        THE RECKONING
      </div>
      <h2 style={{ fontSize: 70, fontWeight: 900, margin: "0 0 40px", lineHeight: 1.1 }}>
        ONLY THE LEANEST<br />
        <span style={{ color: "#10B981" }}>WILL SURVIVE</span>
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ padding: "18px", background: "rgba(239, 68, 68, 0.2)", borderRadius: 12, fontSize: 24, fontWeight: 800, color: "#EF4444" }}>
          ❌ AI WRAPPERS WITHOUT MOATS
        </div>
        <div style={{ padding: "18px", background: "rgba(16, 185, 129, 0.2)", borderRadius: 12, fontSize: 24, fontWeight: 800, color: "#10B981" }}>
          ✔ PROPRIETARY DATA MONOPOLIES
        </div>
      </div>
    </div>
  );
};

// 12. Scene Reset Outro
const SceneResetOutro: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <div style={{ position: "absolute", top: 310, left: 60, right: 60, textAlign: "center" }}>
      <div style={{ color: "#00E5FF", fontSize: 28, fontWeight: 800, letterSpacing: 3, marginBottom: 16 }}>
        THE BIG DEBATE
      </div>
      <h2 style={{ fontSize: 76, fontWeight: 900, margin: "0 0 36px", lineHeight: 1.05 }}>
        BURSTING?<br />
        OR THE<br />
        <span style={{ color: "#FFE600" }}>GREAT RESET?</span>
      </h2>

      <div
        style={{
          display: "inline-block",
          marginTop: 20,
          padding: "18px 36px",
          backgroundColor: "#FFE600",
          color: "#000",
          borderRadius: 40,
          fontSize: 30,
          fontWeight: 900,
          boxShadow: "0 0 35px rgba(255, 230, 0, 0.6)",
        }}
      >
        DROP YOUR TAKE IN COMMENTS 👇
      </div>
    </div>
  );
};
