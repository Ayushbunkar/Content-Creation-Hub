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

export interface NvidiaHoneytrapProps {
  narrationSrc?: string;
  musicSrc?: string;
  subtitlesData?: { cues: CueItem[] };
}

export const NvidiaHoneytrapReel: React.FC<NvidiaHoneytrapProps> = ({
  narrationSrc = "/audio/nvidia_honeytrap_narration.wav",
  musicSrc = "/audio/bgm/mystery_investigation.wav",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // 8 Distinct Scene Beats timed to Whisper speech timestamps
  // Scene 1: 0 - 165 (0 - 5.50s)
  // Scene 2: 165 - 335 (5.50 - 11.16s)
  // Scene 3: 335 - 550 (11.16 - 18.33s)
  // Scene 4: 550 - 765 (18.33 - 25.50s)
  // Scene 5: 765 - 980 (25.50 - 32.66s)
  // Scene 6: 980 - 1185 (32.66 - 39.50s)
  // Scene 7: 1185 - 1395 (39.50 - 46.50s)
  // Scene 8: 1395 - 1500 (46.50 - 50.00s)

  const cutFrames = [0, 165, 335, 550, 765, 980, 1185, 1395];
  let isFlash = false;
  let framesSinceCut = 0;
  for (const cf of cutFrames) {
    if (frame >= cf && frame < cf + 5) {
      isFlash = true;
      framesSinceCut = frame - cf;
      break;
    }
  }

  // Camera Punch-in scale on cuts
  const punchScale = isFlash ? 1.07 - framesSinceCut * 0.014 : 1.0;

  // Active scene calculation
  let activeScene = 1;
  if (frame >= 165 && frame < 335) activeScene = 2;
  else if (frame >= 335 && frame < 550) activeScene = 3;
  else if (frame >= 550 && frame < 765) activeScene = 4;
  else if (frame >= 765 && frame < 980) activeScene = 5;
  else if (frame >= 980 && frame < 1185) activeScene = 6;
  else if (frame >= 1185 && frame < 1395) activeScene = 7;
  else if (frame >= 1395) activeScene = 8;

  // Subtitle phrases mapped to audio timing
  const subtitles = [
    { start: 0, end: 75, text: "How did the world's most powerful AI company...", highlight: "AI COMPANY" },
    { start: 75, end: 165, text: "face a classified counterintelligence nightmare?", highlight: "COUNTERINTELLIGENCE" },
    { start: 165, end: 250, text: "Behind Nvidia's trillion-dollar Blackwell superchips...", highlight: "BLACKWELL SUPERCHIPS" },
    { start: 250, end: 335, text: "lies a covert intelligence battleground.", highlight: "BATTLEGROUND" },
    { start: 335, end: 470, text: "Foreign agencies couldn't breach cyber firewalls...", highlight: "CYBER FIREWALLS" },
    { start: 470, end: 550, text: "So they targeted the human element.", highlight: "HUMAN ELEMENT" },
    { start: 550, end: 660, text: "Classified inquiries probed covert associations...", highlight: "COVERT ASSOCIATIONS" },
    { start: 660, end: 765, text: "unauthorized data corridors & executive vulnerability.", highlight: "EXECUTIVE VULNERABILITY" },
    { start: 765, end: 870, text: "When dominance over global AI hangs in the balance...", highlight: "GLOBAL AI DOMINANCE" },
    { start: 870, end: 980, text: "personal connections become the ultimate backdoor.", highlight: "ULTIMATE BACKDOOR" },
    { start: 980, end: 1080, text: "Emergency board audits. Scrutinized travel.", highlight: "EMERGENCY AUDITS" },
    { start: 1080, end: 1185, text: "Internal governance tightened overnight.", highlight: "GOVERNANCE TIGHTENED" },
    { start: 1185, end: 1300, text: "In the Silicon Cold War, the deadliest weapon isn't malware...", highlight: "SILICON COLD WAR" },
    { start: 1300, end: 1395, text: "It's human compromise.", highlight: "HUMAN COMPROMISE" },
    { start: 1395, end: 1500, text: "[ INVESTIGATION DOSSIER // CASE CLOSED ]", highlight: "CLASSIFIED" },
  ];

  const currentSub = subtitles.find((s) => frame >= s.start && frame < s.end);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#030712",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color: "#F9FAFB",
        overflow: "hidden",
        transform: `scale(${punchScale})`,
      }}
    >
      {/* 1. AUDIO LAYER */}
      {narrationSrc && <Audio src={staticFile(narrationSrc)} volume={1.0} />}
      {musicSrc && (
        <Audio
          src={staticFile(musicSrc)}
          volume={(f) => {
            if (f < 30) return interpolate(f, [0, 30], [0, 0.22]);
            if (f > 1460) return interpolate(f, [1460, 1500], [0.22, 0]);
            return 0.20;
          }}
        />
      )}

      {/* SFX Cues across key cut transitions */}
      {frame >= 0 && frame < 50 && <Audio src={staticFile("/audio/sound-effects/sub-bass-impact.wav")} volume={0.8} />}
      {frame >= 165 && frame < 205 && <Audio src={staticFile("/audio/sound-effects/metallic-impact.wav")} volume={0.7} />}
      {frame >= 335 && frame < 375 && <Audio src={staticFile("/audio/sound-effects/whoosh.wav")} volume={0.75} />}
      {frame >= 550 && frame < 590 && <Audio src={staticFile("/audio/sound-effects/digital-glitch.wav")} volume={0.7} />}
      {frame >= 765 && frame < 805 && <Audio src={staticFile("/audio/sound-effects/cinematic-hit.wav")} volume={0.85} />}
      {frame >= 980 && frame < 1020 && <Audio src={staticFile("/audio/sound-effects/whoosh.wav")} volume={0.7} />}
      {frame >= 1185 && frame < 1225 && <Audio src={staticFile("/audio/sound-effects/riser.wav")} volume={0.9} />}
      {frame >= 1300 && frame < 1340 && <Audio src={staticFile("/audio/sound-effects/cinematic-hit.wav")} volume={0.95} />}

      {/* 2. BACKGROUND GRID & AMBIENT RADAR */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(34, 197, 94, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 197, 94, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          opacity: 0.85,
        }}
      />

      {/* Dynamic Background Alert Glow */}
      <div
        style={{
          position: "absolute",
          top: "28%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background:
            activeScene === 1 || activeScene === 2
              ? "radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, transparent 70%)"
              : activeScene === 3 || activeScene === 4
              ? "radial-gradient(circle, rgba(239, 68, 68, 0.25) 0%, transparent 70%)"
              : activeScene === 5 || activeScene === 6
              ? "radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(225, 29, 72, 0.30) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />

      {/* Vignette Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 160px rgba(0,0,0,0.85)",
          pointerEvents: "none",
        }}
      />

      {/* 3. TOP CLASSIFIED HUD HEADER (Mobile Safe Area) */}
      <div
        style={{
          position: "absolute",
          top: 90,
          left: 60,
          right: 60,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
          paddingBottom: 20,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              backgroundColor: frame % 24 < 12 ? "#EF4444" : "#7F1D1D",
              boxShadow: "0 0 14px #EF4444",
            }}
          />
          <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: 4, color: "#EF4444" }}>
            SPECIAL INVESTIGATION
          </span>
          <span style={{ fontSize: 18, color: "#9CA3AF", letterSpacing: 2 }}>
            // FILE: NV-SPARK
          </span>
        </div>

        <div
          style={{
            padding: "6px 14px",
            backgroundColor: "rgba(239, 68, 68, 0.18)",
            border: "1px solid rgba(239, 68, 68, 0.5)",
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 2,
            color: "#FCA5A5",
          }}
        >
          TOP SECRET
        </div>
      </div>

      {/* 4. MAIN SCENE CONTENT CANVAS */}
      <div
        style={{
          position: "absolute",
          top: 240,
          left: 60,
          right: 60,
          height: 1150,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 20,
        }}
      >
        {/* ================= SCENE 1: THE NIGHTMARE HOOK ================= */}
        {activeScene === 1 && (
          <div style={{ textAlign: "center", width: "100%", animation: "fadeIn 0.3s" }}>
            <div
              style={{
                display: "inline-block",
                padding: "8px 20px",
                backgroundColor: "rgba(34, 197, 94, 0.12)",
                border: "1px solid #22C55E",
                borderRadius: 999,
                color: "#4ADE80",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 3,
                marginBottom: 35,
              }}
            >
              SILICON VALLEY COUNTERINTELLIGENCE
            </div>

            <div
              style={{
                fontSize: 66,
                fontWeight: 900,
                lineHeight: 1.15,
                letterSpacing: -1,
                color: "#FFFFFF",
                textTransform: "uppercase",
              }}
            >
              HOW DID <span style={{ color: "#76B900" }}>NVIDIA</span> FACE A CLASSIFIED CRISIS?
            </div>

            {/* Radar Visual Scanner */}
            <div
              style={{
                marginTop: 60,
                width: 320,
                height: 320,
                borderRadius: "50%",
                border: "2px solid rgba(118, 185, 0, 0.3)",
                margin: "50px auto 0",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 200,
                  height: 200,
                  borderRadius: "50%",
                  border: "1px dashed rgba(118, 185, 0, 0.5)",
                  position: "relative",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  width: "100%",
                  height: 2,
                  backgroundColor: "#76B900",
                  boxShadow: "0 0 15px #76B900",
                  transform: `rotate(${frame * 4}deg)`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  padding: "10px 18px",
                  backgroundColor: "rgba(0,0,0,0.85)",
                  border: "1px solid #76B900",
                  borderRadius: 8,
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#76B900",
                }}
              >
                TARGET: NVDA HQ
              </div>
            </div>
          </div>
        )}

        {/* ================= SCENE 2: BLACKWELL SUPERCHIP STAKES ================= */}
        {activeScene === 2 && (
          <div style={{ width: "100%", textAlign: "center" }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: 4,
                color: "#76B900",
                marginBottom: 20,
              }}
            >
              BLACKWELL B200 // MONOPOLY POWER
            </div>

            <div
              style={{
                fontSize: 54,
                fontWeight: 900,
                lineHeight: 1.15,
                color: "#FFFFFF",
                marginBottom: 40,
              }}
            >
              THE WORLD'S MOST VALUABLE SILICON
            </div>

            {/* Chip Schematic Card */}
            <div
              style={{
                backgroundColor: "rgba(15, 23, 42, 0.9)",
                border: "2px solid rgba(118, 185, 0, 0.6)",
                borderRadius: 24,
                padding: 40,
                boxShadow: "0 0 50px rgba(118, 185, 0, 0.2)",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 25 }}>
                <span style={{ fontSize: 20, color: "#94A3B8" }}>ARCHITECTURE:</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#76B900" }}>208B TRANSISTORS</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 25 }}>
                <span style={{ fontSize: 20, color: "#94A3B8" }}>MARKET VALUATION:</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#38BDF8" }}>$3.4 TRILLION</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 25 }}>
                <span style={{ fontSize: 20, color: "#94A3B8" }}>AI INFRASTRUCTURE:</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#F59E0B" }}>90% GLOBAL COMPUTE</span>
              </div>
              <div
                style={{
                  marginTop: 20,
                  padding: 18,
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.5)",
                  borderRadius: 12,
                  fontSize: 19,
                  fontWeight: 700,
                  color: "#F87171",
                  textAlign: "center",
                }}
              >
                ⚠️ SOVEREIGN INTELLIGENCE PRIORITY #1
              </div>
            </div>
          </div>
        )}

        {/* ================= SCENE 3: FIREWALL VS HUMAN ELEMENT ================= */}
        {activeScene === 3 && (
          <div style={{ width: "100%", textAlign: "center" }}>
            <div
              style={{
                fontSize: 50,
                fontWeight: 900,
                lineHeight: 1.2,
                color: "#FFFFFF",
                marginBottom: 40,
              }}
            >
              THEY COULDN'T HACK THE SERVERS.
            </div>

            {/* Split Comparison Box */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
              <div
                style={{
                  backgroundColor: "rgba(15, 23, 42, 0.8)",
                  border: "2px solid #38BDF8",
                  borderRadius: 20,
                  padding: 26,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#38BDF8" }}>CYBER FIREWALLS</div>
                  <div style={{ fontSize: 18, color: "#94A3B8" }}>4096-bit Zero Trust Encryption</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#22C55E" }}>[ IMPENETRABLE ]</div>
              </div>

              <div
                style={{
                  backgroundColor: "rgba(69, 10, 10, 0.85)",
                  border: "2px solid #EF4444",
                  borderRadius: 20,
                  padding: 26,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  boxShadow: "0 0 35px rgba(239, 68, 68, 0.35)",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: "#EF4444" }}>THE HUMAN FACTOR</div>
                  <div style={{ fontSize: 18, color: "#FCA5A5" }}>Personal Ties & Vulnerabilities</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#F87171" }}>[ BACKDOOR ]</div>
              </div>
            </div>

            <div
              style={{
                marginTop: 45,
                fontSize: 28,
                fontWeight: 800,
                color: "#FACC15",
                letterSpacing: 2,
              }}
            >
              "TARGET THE PEOPLE, NOT THE CODE."
            </div>
          </div>
        )}

        {/* ================= SCENE 4: INVESTIGATION DOSSIER & FLIGHTS ================= */}
        {activeScene === 4 && (
          <div style={{ width: "100%", textAlign: "center" }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: 4,
                color: "#EF4444",
                marginBottom: 20,
              }}
            >
              CLASSIFIED EVIDENCE DOSSIER
            </div>

            <div
              style={{
                backgroundColor: "#0B0F19",
                border: "2px dashed #DC2626",
                borderRadius: 20,
                padding: 35,
                textAlign: "left",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 15,
                  right: 20,
                  color: "#EF4444",
                  fontSize: 18,
                  fontWeight: 900,
                  border: "2px solid #EF4444",
                  padding: "4px 10px",
                  transform: "rotate(6deg)",
                }}
              >
                REDACTED
              </div>

              <div style={{ fontSize: 22, fontWeight: 800, color: "#FFFFFF", marginBottom: 15 }}>
                INQUIRY SUBJECT: COVERT CHANNELS
              </div>

              <div style={{ fontSize: 18, color: "#CBD5E1", lineHeight: 1.6, marginBottom: 20 }}>
                • Travel corridor: <span style={{ backgroundColor: "#1E293B", padding: "2px 8px" }}>SAN FRANCISCO ✈ TAIPEI ✈ ASIA</span><br />
                • Counterintelligence flags: <span style={{ color: "#F87171", fontWeight: 700 }}>UNAUTHORIZED DISCLOSURES</span><br />
                • Foreign contacts: <span style={{ backgroundColor: "#334155", color: "#334155" }}>████████████████</span>
              </div>

              <div
                style={{
                  padding: "14px 20px",
                  backgroundColor: "rgba(220, 38, 38, 0.2)",
                  borderRadius: 10,
                  fontSize: 18,
                  color: "#FECACA",
                  fontWeight: 600,
                }}
              >
                Interviews conducted by independent security counsel under board oversight.
              </div>
            </div>
          </div>
        )}

        {/* ================= SCENE 5: GEOPOLITICAL AI BALANCE ================= */}
        {activeScene === 5 && (
          <div style={{ width: "100%", textAlign: "center" }}>
            <div
              style={{
                fontSize: 56,
                fontWeight: 900,
                lineHeight: 1.15,
                color: "#FFFFFF",
                marginBottom: 35,
              }}
            >
              SOVEREIGN AI HANGS IN THE BALANCE
            </div>

            <div
              style={{
                width: "100%",
                padding: 30,
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                borderRadius: 20,
                border: "2px solid #F59E0B",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 15, marginBottom: 20 }}>
                <span style={{ fontSize: 32 }}>🌐</span>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#FBBF24" }}>EXPORT RESTRICTIONS</div>
                  <div style={{ fontSize: 17, color: "#94A3B8" }}>Strict US Dept of Commerce Controls</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 15, marginBottom: 20 }}>
                <span style={{ fontSize: 32 }}>🛡️</span>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#38BDF8" }}>NATIONAL DEFENSE NETWORKS</div>
                  <div style={{ fontSize: 17, color: "#94A3B8" }}>Critical infrastructure running on CUDA</div>
                </div>
              </div>

              <div
                style={{
                  padding: 16,
                  backgroundColor: "rgba(245, 158, 11, 0.15)",
                  borderRadius: 12,
                  fontSize: 19,
                  fontWeight: 700,
                  color: "#FDE68A",
                  textAlign: "center",
                }}
              >
                ONE EXECUTIVE CONTACT CAN LEAK ENTIRE ROADMAPS
              </div>
            </div>
          </div>
        )}

        {/* ================= SCENE 6: BOARDROOM EMERGENCY CONTROLS ================= */}
        {activeScene === 6 && (
          <div style={{ width: "100%", textAlign: "center" }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: 3,
                color: "#F59E0B",
                marginBottom: 20,
              }}
            >
              CORPORATE GOVERNANCE CRISIS
            </div>

            <div
              style={{
                fontSize: 52,
                fontWeight: 900,
                lineHeight: 1.2,
                color: "#FFFFFF",
                marginBottom: 40,
              }}
            >
              EMERGENCY AUDITS & PROTOCOL LOCK
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
              <div
                style={{
                  padding: "20px 25px",
                  backgroundColor: "#0F172A",
                  borderLeft: "6px solid #22C55E",
                  borderRadius: 12,
                  textAlign: "left",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#E2E8F0",
                }}
              >
                ✓ External Legal Counsel Engaged
              </div>
              <div
                style={{
                  padding: "20px 25px",
                  backgroundColor: "#0F172A",
                  borderLeft: "6px solid #38BDF8",
                  borderRadius: 12,
                  textAlign: "left",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#E2E8F0",
                }}
              >
                ✓ Foreign Travel Authorizations Revoked
              </div>
              <div
                style={{
                  padding: "20px 25px",
                  backgroundColor: "#0F172A",
                  borderLeft: "6px solid #EF4444",
                  borderRadius: 12,
                  textAlign: "left",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#E2E8F0",
                }}
              >
                ✓ Internal Executive Communications Screened
              </div>
            </div>
          </div>
        )}

        {/* ================= SCENE 7: THE CLIMAX VERDICT ================= */}
        {activeScene === 7 && (
          <div style={{ width: "100%", textAlign: "center" }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: 4,
                color: "#EF4444",
                marginBottom: 25,
              }}
            >
              THE SILICON COLD WAR
            </div>

            <div
              style={{
                fontSize: 60,
                fontWeight: 900,
                lineHeight: 1.15,
                color: "#FFFFFF",
                marginBottom: 35,
              }}
            >
              THE DEADLIEST WEAPON IS NOT MALWARE.
            </div>

            <div
              style={{
                padding: "30px 40px",
                backgroundColor: "rgba(225, 29, 72, 0.25)",
                border: "3px solid #E11D48",
                borderRadius: 24,
                boxShadow: "0 0 60px rgba(225, 29, 72, 0.4)",
              }}
            >
              <div
                style={{
                  fontSize: 52,
                  fontWeight: 900,
                  color: "#FFE4E6",
                  letterSpacing: 2,
                }}
              >
                IT IS HUMAN COMPROMISE.
              </div>
            </div>
          </div>
        )}

        {/* ================= SCENE 8: DOSSIER STAMP OUTRO ================= */}
        {activeScene === 8 && (
          <div style={{ width: "100%", textAlign: "center" }}>
            <div
              style={{
                width: 180,
                height: 180,
                borderRadius: "50%",
                border: "4px solid #22C55E",
                margin: "0 auto 30px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 40px rgba(34, 197, 94, 0.4)",
              }}
            >
              <span style={{ fontSize: 70 }}>🔒</span>
            </div>

            <div style={{ fontSize: 48, fontWeight: 900, color: "#FFFFFF", marginBottom: 15 }}>
              INTELLIGENCE SECURED
            </div>

            <div style={{ fontSize: 22, color: "#94A3B8", letterSpacing: 3 }}>
              COUNTERMEASURES ENFORCED // 2026
            </div>
          </div>
        )}
      </div>

      {/* 5. WORD-BY-WORD KINETIC CAPTIONS OVERLAY (Lower Third) */}
      <div
        style={{
          position: "absolute",
          bottom: 180,
          left: 60,
          right: 60,
          textAlign: "center",
          zIndex: 50,
        }}
      >
        {currentSub && (
          <div
            style={{
              display: "inline-block",
              padding: "20px 32px",
              backgroundColor: "rgba(3, 7, 18, 0.92)",
              backdropFilter: "blur(12px)",
              border: "2px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 20,
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)",
              maxWidth: "95%",
            }}
          >
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                lineHeight: 1.35,
                color: "#FFFFFF",
                letterSpacing: 0.5,
              }}
            >
              {currentSub.text.split(" ").map((w, i) => {
                const isKey = currentSub.highlight.includes(w.toUpperCase().replace(/[^A-Z]/g, ""));
                return (
                  <span
                    key={i}
                    style={{
                      color: isKey ? "#FACC15" : "#FFFFFF",
                      textShadow: isKey ? "0 0 16px rgba(250, 204, 21, 0.7)" : "none",
                      fontWeight: isKey ? 900 : 800,
                      marginRight: 8,
                    }}
                  >
                    {w}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 6. BOTTOM PROGRESS BAR */}
      <div
        style={{
          position: "absolute",
          bottom: 70,
          left: 60,
          right: 60,
          height: 8,
          backgroundColor: "rgba(255, 255, 255, 0.12)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(frame / 1500) * 100}%`,
            background: "linear-gradient(90deg, #76B900, #FACC15, #EF4444)",
            borderRadius: 4,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export default NvidiaHoneytrapReel;
