import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Video,
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
}

export const NvidiaHoneytrapReel: React.FC<NvidiaHoneytrapProps> = ({
  narrationSrc = "/audio/nvidia_honeytrap_narration.wav",
  musicSrc = "/audio/bgm/mystery_investigation.wav",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Fast cinematic cut boundaries across 50 seconds (1500 frames @ 30fps)
  // Scene 1: 0 - 165
  //   1.1: 0 - 15 (Black frame intro)
  //   1.2: 15 - 66 (NVIDIA HQ Building)
  //   1.3: 66 - 114 (Jensen Huang Keynote)
  //   1.4: 114 - 165 (Surveillance Cut + Case File Stamp)
  // Scene 2: 165 - 335
  //   2.1: 165 - 225 (Wafer Cleanroom)
  //   2.2: 225 - 285 (Blackwell B200 Macro Chip)
  //   2.3: 285 - 335 (Datacenter Supercluster Video + Market Cap)
  // Scene 3: 335 - 550
  //   3.1: 335 - 435 (Cyber Operations Center Video & SOC)
  //   3.2: 435 - 550 (Executive Silhouette in Airport Corridor)
  // Scene 4: 550 - 765
  //   4.1: 550 - 625 (Commercial Aircraft Flying Above Clouds)
  //   4.2: 625 - 695 (Animated Flight Map SF -> Taipei)
  //   4.3: 695 - 765 (Investigative Dossier & Redacted Documents)
  // Scene 5: 765 - 980
  //   5.1: 765 - 855 (Taiwan Strait Maritime Shipping Video)
  //   5.2: 855 - 980 (Global Satellite Zoom & Export Controls)
  // Scene 6: 980 - 1185
  //   6.1: 980 - 1085 (Boardroom Executive Conference Table)
  //   6.2: 1085 - 1185 (Finance & Trade Scrutiny Video)
  // Scene 7: 1185 - 1395
  //   7.1: 1185 - 1235 (Macro Chip Red Alert)
  //   7.2: 1235 - 1285 (Jensen Huang Stage Lighting)
  //   7.3: 1285 - 1335 (Server Room Racks)
  //   7.4: 1335 - 1395 (Pure Black Background + Bold Climax Typography)
  // Scene 8: 1395 - 1500
  //   8.1: 1395 - 1500 (Server Room Outro + Case Closed Mechanical Lock)

  const cutFrames = [0, 15, 66, 114, 165, 225, 285, 335, 435, 550, 625, 695, 765, 855, 980, 1085, 1185, 1235, 1285, 1335, 1395];
  
  let isCutFlash = false;
  let cutOffset = 0;
  for (const cf of cutFrames) {
    if (frame >= cf && frame < cf + 3) {
      isCutFlash = true;
      cutOffset = frame - cf;
      break;
    }
  }

  // Camera Punch Scale on cuts
  const punchScale = isCutFlash ? 1.05 - cutOffset * 0.015 : 1.0;

  // Kinetic subtitles synchronized to exact Whisper word-level timing
  const subtitles = [
    { start: 0, end: 75, text: "How did the world's most powerful AI company...", highlight: "AI COMPANY" },
    { start: 75, end: 165, text: "face a classified counterintelligence nightmare?", highlight: "COUNTERINTELLIGENCE" },
    { start: 165, end: 250, text: "Behind Nvidia's trillion-dollar Blackwell superchips...", highlight: "BLACKWELL SUPERCHIPS" },
    { start: 250, end: 335, text: "lies an intelligence battleground.", highlight: "INTELLIGENCE BATTLEGROUND" },
    { start: 335, end: 470, text: "Foreign agencies couldn't breach multi-layered cyber firewalls...", highlight: "CYBER FIREWALLS" },
    { start: 470, end: 550, text: "So they targeted the human element.", highlight: "HUMAN ELEMENT" },
    { start: 550, end: 660, text: "Classified inquiries probed covert associations...", highlight: "COVERT ASSOCIATIONS" },
    { start: 660, end: 765, text: "unauthorized data corridors and executive vulnerability.", highlight: "EXECUTIVE VULNERABILITY" },
    { start: 765, end: 870, text: "When strategic dominance over global AI hangs in the balance...", highlight: "GLOBAL AI DOMINANCE" },
    { start: 870, end: 980, text: "personal connections become the ultimate backdoor.", highlight: "ULTIMATE BACKDOOR" },
    { start: 980, end: 1080, text: "Corporate boards launched emergency audits. Scrutinized travel.", highlight: "EMERGENCY AUDITS" },
    { start: 1080, end: 1185, text: "Internal governance tightened overnight.", highlight: "GOVERNANCE TIGHTENED" },
    { start: 1185, end: 1300, text: "Because in the Silicon Cold War, the deadliest weapon isn't malware...", highlight: "SILICON COLD WAR" },
    { start: 1300, end: 1395, text: "It's human compromise.", highlight: "HUMAN COMPROMISE" },
    { start: 1395, end: 1500, text: "INVESTIGATION DOSSIER // CASE CLOSED", highlight: "CASE CLOSED" },
  ];

  const currentSub = subtitles.find((s) => frame >= s.start && frame < s.end);

  // Helper for Ken Burns image zoom & pan
  const kenBurns = (startF: number, durF: number, scaleStart = 1.0, scaleEnd = 1.12, panX = 0, panY = 0) => {
    const progress = Math.min(1, Math.max(0, (frame - startF) / durF));
    const s = interpolate(progress, [0, 1], [scaleStart, scaleEnd]);
    const x = interpolate(progress, [0, 1], [0, panX]);
    const y = interpolate(progress, [0, 1], [0, panY]);
    return {
      transform: `scale(${s}) translate(${x}px, ${y}px)`,
      transition: "transform 0.05s linear",
    };
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color: "#FFFFFF",
        overflow: "hidden",
        transform: `scale(${punchScale})`,
      }}
    >
      {/* ================= 1. AUDIO LAYER ================= */}
      {narrationSrc && <Audio src={staticFile(narrationSrc)} volume={1.0} />}
      {musicSrc && (
        <Audio
          src={staticFile(musicSrc)}
          volume={(f) => {
            if (f < 30) return interpolate(f, [0, 30], [0, 0.22]);
            if (f >= 1185 && f < 1335) return 0.28; // Building climax
            if (f >= 1335 && f < 1395) return 0.32; // Peak climax
            if (f > 1460) return interpolate(f, [1460, 1500], [0.30, 0]); // Controlled fade-out
            return 0.20;
          }}
        />
      )}

      {/* Synchronized Sound Effects */}
      {frame >= 12 && frame < 50 && <Audio src={staticFile("/audio/sound-effects/sub-bass-impact.wav")} volume={0.85} />}
      {frame >= 114 && frame < 154 && <Audio src={staticFile("/audio/sound-effects/digital-glitch.wav")} volume={0.7} />}
      {frame >= 165 && frame < 205 && <Audio src={staticFile("/audio/sound-effects/metallic-impact.wav")} volume={0.75} />}
      {frame >= 285 && frame < 325 && <Audio src={staticFile("/audio/sound-effects/whoosh.wav")} volume={0.7} />}
      {frame >= 435 && frame < 475 && <Audio src={staticFile("/audio/sound-effects/cinematic-hit.wav")} volume={0.8} />}
      {frame >= 550 && frame < 590 && <Audio src={staticFile("/audio/sound-effects/whoosh.wav")} volume={0.75} />}
      {frame >= 695 && frame < 735 && <Audio src={staticFile("/audio/sound-effects/click.wav")} volume={0.8} />}
      {frame >= 765 && frame < 805 && <Audio src={staticFile("/audio/sound-effects/low-rumble.wav")} volume={0.75} />}
      {frame >= 980 && frame < 1020 && <Audio src={staticFile("/audio/sound-effects/metallic-impact.wav")} volume={0.7} />}
      {frame >= 1185 && frame < 1225 && <Audio src={staticFile("/audio/sound-effects/riser.wav")} volume={0.9} />}
      {frame >= 1335 && frame < 1375 && <Audio src={staticFile("/audio/sound-effects/cinematic-hit.wav")} volume={1.0} />}
      {frame >= 1395 && frame < 1435 && <Audio src={staticFile("/audio/sound-effects/sub-bass-impact.wav")} volume={0.85} />}

      {/* ================= 2. CINEMATIC VISUAL FOOTAGE LAYER ================= */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        
        {/* ----- SCENE 1: THE NIGHTMARE HOOK (0 - 165) ----- */}
        {frame >= 0 && frame < 15 && (
          <div style={{ width: "100%", height: "100%", backgroundColor: "#000000" }} />
        )}

        {frame >= 15 && frame < 66 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Img
              src={staticFile("/assets/nvidia_investigation/nvidia_hq.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.15) brightness(0.9) saturate(1.1)",
                ...kenBurns(15, 51, 1.0, 1.08, 0, -15),
              }}
            />
            {/* Editorial Location Badge */}
            <div
              style={{
                position: "absolute",
                top: 180,
                left: 60,
                backgroundColor: "rgba(0,0,0,0.85)",
                borderLeft: "4px solid #76B900",
                padding: "8px 16px",
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: 2,
                color: "#FFFFFF",
              }}
            >
              SANTA CLARA, CA // NVIDIA WORLD HEADQUARTERS
            </div>
          </div>
        )}

        {frame >= 66 && frame < 114 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Img
              src={staticFile("/assets/nvidia_investigation/jensen_huang.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.2) brightness(0.92)",
                ...kenBurns(66, 48, 1.0, 1.09, -10, 0),
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 180,
                left: 60,
                backgroundColor: "rgba(0,0,0,0.85)",
                borderLeft: "4px solid #38BDF8",
                padding: "8px 16px",
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: 2,
                color: "#E0F2FE",
              }}
            >
              GTC KEYNOTE // CHIP ARCHITECTURE LAUNCH
            </div>
          </div>
        )}

        {frame >= 114 && frame < 165 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Video
              src={staticFile("/videos/library/military_surveillance.mp4")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.25) brightness(0.85)",
              }}
            />
            {/* Red Classified Overlay Flash */}
            <div
              style={{
                position: "absolute",
                top: "40%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                backgroundColor: "rgba(185, 28, 28, 0.9)",
                border: "3px solid #EF4444",
                borderRadius: 12,
                padding: "20px 35px",
                textAlign: "center",
                boxShadow: "0 0 50px rgba(239, 68, 68, 0.6)",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 4, color: "#FECACA" }}>
                COUNTERINTELLIGENCE ALERT
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#FFFFFF", marginTop: 5 }}>
                CASE FILE: NV-SPARK
              </div>
            </div>
          </div>
        )}

        {/* ----- SCENE 2: BLACKWELL SUPERCHIP STAKES (165 - 335) ----- */}
        {frame >= 165 && frame < 225 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Img
              src={staticFile("/assets/nvidia_investigation/wafer_cleanroom.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.15) brightness(0.88)",
                ...kenBurns(165, 60, 1.0, 1.08, 0, 15),
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 180,
                left: 60,
                backgroundColor: "rgba(0,0,0,0.85)",
                borderLeft: "4px solid #76B900",
                padding: "8px 16px",
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: 2,
                color: "#76B900",
              }}
            >
              3nm CLEANROOM FABRICATION // TSMC FOUNDRY
            </div>
          </div>
        )}

        {frame >= 225 && frame < 285 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Img
              src={staticFile("/assets/nvidia_investigation/blackwell_chip.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.25) brightness(0.9)",
                ...kenBurns(225, 60, 1.0, 1.12, 10, -10),
              }}
            />
            {/* Technical Silicon Annotations */}
            <div
              style={{
                position: "absolute",
                bottom: 300,
                left: 60,
                backgroundColor: "rgba(15, 23, 42, 0.9)",
                border: "2px solid #76B900",
                borderRadius: 12,
                padding: "16px 24px",
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 900, color: "#76B900" }}>NVIDIA BLACKWELL B200</div>
              <div style={{ fontSize: 16, color: "#CBD5E1", marginTop: 4 }}>
                • 208 Billion Transistors • Dual-Die Architecture • 10 TB/s Interconnect
              </div>
            </div>
          </div>
        )}

        {frame >= 285 && frame < 335 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Video
              src={staticFile("/videos/library/datacenter_tech.mp4")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.2) brightness(0.85)",
              }}
            />
            {/* Market Cap Live Data Ticker */}
            <div
              style={{
                position: "absolute",
                top: 180,
                right: 60,
                backgroundColor: "rgba(0,0,0,0.85)",
                borderRight: "4px solid #38BDF8",
                padding: "10px 18px",
                textAlign: "right",
              }}
            >
              <div style={{ fontSize: 26, fontWeight: 900, color: "#38BDF8" }}>$3.4 TRILLION</div>
              <div style={{ fontSize: 14, color: "#94A3B8", letterSpacing: 1 }}>MARKET DOMINANCE // 90% AI COMPUTE</div>
            </div>
          </div>
        )}

        {/* ----- SCENE 3: FIREWALL VS HUMAN BACKDOOR (335 - 550) ----- */}
        {frame >= 335 && frame < 435 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Img
              src={staticFile("/assets/nvidia_investigation/cyber_soc.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.2) brightness(0.85) saturate(1.1)",
                ...kenBurns(335, 100, 1.0, 1.08, -15, 0),
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 180,
                left: 60,
                backgroundColor: "rgba(15, 23, 42, 0.9)",
                borderLeft: "4px solid #38BDF8",
                padding: "10px 18px",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: "#38BDF8" }}>ZERO-TRUST DEFENSE ENCLAVE</div>
              <div style={{ fontSize: 14, color: "#94A3B8" }}>4096-bit Multi-Layer Encryption • Impenetrable</div>
            </div>
          </div>
        )}

        {frame >= 435 && frame < 550 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Img
              src={staticFile("/assets/nvidia_investigation/executive_silhouette.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.3) brightness(0.8) sepia(0.2)",
                ...kenBurns(435, 115, 1.0, 1.10, 0, -20),
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "35%",
                left: 60,
                right: 60,
                backgroundColor: "rgba(69, 10, 10, 0.9)",
                border: "2px solid #EF4444",
                borderRadius: 16,
                padding: "24px 30px",
                textAlign: "center",
                boxShadow: "0 0 40px rgba(239, 68, 68, 0.4)",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: "#FCA5A5", letterSpacing: 3 }}>
                CRITICAL VULNERABILITY
              </div>
              <div style={{ fontSize: 44, fontWeight: 900, color: "#FFFFFF", marginTop: 6 }}>
                THE HUMAN ELEMENT
              </div>
              <div style={{ fontSize: 18, color: "#FECACA", marginTop: 8 }}>
                Target the people, not the code.
              </div>
            </div>
          </div>
        )}

        {/* ----- SCENE 4: CLASSIFIED EVIDENCE DOSSIER (550 - 765) ----- */}
        {frame >= 550 && frame < 625 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Img
              src={staticFile("/assets/nvidia_investigation/airport_flight.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.15) brightness(0.9)",
                ...kenBurns(550, 75, 1.0, 1.08, 15, 0),
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 180,
                left: 60,
                backgroundColor: "rgba(0,0,0,0.85)",
                borderLeft: "4px solid #F59E0B",
                padding: "8px 16px",
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: 2,
                color: "#FDE68A",
              }}
            >
              INTERNATIONAL TRAVEL CORRIDORS // PACIFIC FLIGHTS
            </div>
          </div>
        )}

        {frame >= 625 && frame < 695 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative", backgroundColor: "#060D1A" }}>
            {/* Real Geographical Route Map Canvas */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `
                  radial-gradient(circle at 75% 30%, rgba(56, 189, 248, 0.15), transparent 50%),
                  radial-gradient(circle at 25% 65%, rgba(245, 158, 11, 0.15), transparent 50%)
                `,
              }}
            />
            {/* Map Route Graphics */}
            <div style={{ position: "absolute", top: "28%", left: 60, right: 60, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#38BDF8", letterSpacing: 4, marginBottom: 20 }}>
                SURVEILLANCE FLIGHT CORRIDOR
              </div>
              <div
                style={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "2px solid #38BDF8",
                  borderRadius: 20,
                  padding: 30,
                  display: "flex",
                  justifyContent: "space-around",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#FFFFFF" }}>SAN FRANCISCO</div>
                  <div style={{ fontSize: 16, color: "#94A3B8" }}>Silicon Valley Hub</div>
                </div>
                <div style={{ fontSize: 36, color: "#F59E0B" }}>✈ ➔</div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#FFFFFF" }}>TAIPEI</div>
                  <div style={{ fontSize: 16, color: "#94A3B8" }}>Semiconductor Corridor</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {frame >= 695 && frame < 765 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Img
              src={staticFile("/assets/nvidia_investigation/investigation_room.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.2) brightness(0.85)",
                ...kenBurns(695, 70, 1.0, 1.07, 0, 10),
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 300,
                left: 60,
                right: 60,
                backgroundColor: "rgba(11, 15, 25, 0.92)",
                border: "2px solid #EF4444",
                borderRadius: 16,
                padding: "20px 25px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#EF4444" }}>INTERNAL INQUIRY DOSSIER</span>
                <span style={{ fontSize: 14, backgroundColor: "#EF4444", color: "#FFF", padding: "3px 8px", borderRadius: 4, fontWeight: 900 }}>CONFIDENTIAL</span>
              </div>
              <div style={{ fontSize: 16, color: "#CBD5E1", marginTop: 8 }}>
                Unauthorized contacts & personal ties placed under governance review.
              </div>
              <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 6, fontStyle: "italic" }}>
                [Illustrative Investigative Reconstruction]
              </div>
            </div>
          </div>
        )}

        {/* ----- SCENE 5: GEOPOLITICAL AI BALANCE (765 - 980) ----- */}
        {frame >= 765 && frame < 855 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Video
              src={staticFile("/videos/library/ocean_naval.mp4")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.15) brightness(0.85)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 180,
                left: 60,
                backgroundColor: "rgba(0,0,0,0.85)",
                borderLeft: "4px solid #F59E0B",
                padding: "10px 18px",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: "#FBBF24" }}>TAIWAN STRAIT MARITIME PASSAGE</div>
              <div style={{ fontSize: 14, color: "#94A3B8" }}>Global Silicon Chokepoint • 90% Advanced Processors</div>
            </div>
          </div>
        )}

        {frame >= 855 && frame < 980 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Video
              src={staticFile("/videos/library/satellite_globe.mp4")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.25) brightness(0.82)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "32%",
                left: 60,
                right: 60,
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                border: "2px solid #38BDF8",
                borderRadius: 16,
                padding: "24px 30px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: "#38BDF8", letterSpacing: 2 }}>
                GEOPOLITICAL CROSSFIRE
              </div>
              <div style={{ fontSize: 38, fontWeight: 900, color: "#FFFFFF", marginTop: 8 }}>
                US EXPORT CONTROLS
              </div>
              <div style={{ fontSize: 17, color: "#CBD5E1", marginTop: 8 }}>
                Department of Commerce high-compute restrictions enforce national security boundaries.
              </div>
            </div>
          </div>
        )}

        {/* ----- SCENE 6: BOARDROOM EMERGENCY CONTROLS (980 - 1185) ----- */}
        {frame >= 980 && frame < 1085 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Img
              src={staticFile("/assets/nvidia_investigation/boardroom_meeting.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.2) brightness(0.85)",
                ...kenBurns(980, 105, 1.0, 1.08, -10, 0),
              }}
            />
            {/* Animated Boardroom Action Checklist */}
            <div
              style={{
                position: "absolute",
                top: "28%",
                left: 60,
                right: 60,
                backgroundColor: "rgba(3, 7, 18, 0.92)",
                border: "2px solid #22C55E",
                borderRadius: 20,
                padding: "26px 30px",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 900, color: "#22C55E", letterSpacing: 2, marginBottom: 15 }}>
                INTERNAL GOVERNANCE AUDIT
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 18, color: "#F3F4F6", fontWeight: 700 }}>
                  <span style={{ color: "#22C55E", marginRight: 8 }}>✓</span> External Legal Counsel Review
                </div>
                <div style={{ fontSize: 18, color: "#F3F4F6", fontWeight: 700 }}>
                  <span style={{ color: "#22C55E", marginRight: 8 }}>✓</span> Overseas Travel Policy Oversight
                </div>
                <div style={{ fontSize: 18, color: "#F3F4F6", fontWeight: 700 }}>
                  <span style={{ color: "#22C55E", marginRight: 8 }}>✓</span> Executive Communication Protocols
                </div>
                <div style={{ fontSize: 18, color: "#F3F4F6", fontWeight: 700 }}>
                  <span style={{ color: "#22C55E", marginRight: 8 }}>✓</span> Governance Compliance Assessment
                </div>
              </div>
            </div>
          </div>
        )}

        {frame >= 1085 && frame < 1185 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Video
              src={staticFile("/videos/library/finance_trade.mp4")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.2) brightness(0.85)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 180,
                left: 60,
                backgroundColor: "rgba(0,0,0,0.85)",
                borderLeft: "4px solid #E11D48",
                padding: "10px 18px",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: "#FDA4AF" }}>SCRUTINY UNDER SEC & BOARD OVERSIGHT</div>
              <div style={{ fontSize: 14, color: "#94A3B8" }}>Maintaining Institutional Integrity Amid Geopolitical Pressure</div>
            </div>
          </div>
        )}

        {/* ----- SCENE 7: THE CLIMAX MONTAGE (1185 - 1395) ----- */}
        {frame >= 1185 && frame < 1235 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Img
              src={staticFile("/assets/nvidia_investigation/blackwell_chip.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.4) brightness(0.9) hue-rotate(-20deg)",
                ...kenBurns(1185, 50, 1.0, 1.15, 0, 0),
              }}
            />
          </div>
        )}

        {frame >= 1235 && frame < 1285 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Img
              src={staticFile("/assets/nvidia_investigation/jensen_huang.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.3) brightness(0.85)",
                ...kenBurns(1235, 50, 1.05, 1.15, 0, -10),
              }}
            />
          </div>
        )}

        {frame >= 1285 && frame < 1335 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Img
              src={staticFile("/assets/nvidia_investigation/datacenter_servers.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.3) brightness(0.8) saturate(1.2)",
                ...kenBurns(1285, 50, 1.0, 1.10, 0, 0),
              }}
            />
          </div>
        )}

        {frame >= 1335 && frame < 1395 && (
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#000000",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              padding: 60,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: 6,
                color: "#94A3B8",
                textTransform: "uppercase",
                marginBottom: 20,
              }}
            >
              THE DEADLIEST WEAPON
            </div>
            <div
              style={{
                fontSize: 66,
                fontWeight: 900,
                lineHeight: 1.1,
                color: "#FFFFFF",
                letterSpacing: -1,
                textTransform: "uppercase",
              }}
            >
              IS <span style={{ color: "#EF4444", textShadow: "0 0 30px rgba(239, 68, 68, 0.8)" }}>HUMAN COMPROMISE</span>.
            </div>
          </div>
        )}

        {/* ----- SCENE 8: CASE LOCKED OUTRO (1395 - 1500) ----- */}
        {frame >= 1395 && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <Video
              src={staticFile("/videos/library/datacenter_tech.mp4")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.3) brightness(0.5)",
              }}
            />
            {/* Investigation File Close Stamping */}
            <div
              style={{
                position: "absolute",
                top: "40%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                backgroundColor: "rgba(3, 7, 18, 0.95)",
                border: "3px solid #22C55E",
                borderRadius: 20,
                padding: "35px 45px",
                textAlign: "center",
                boxShadow: "0 0 60px rgba(34, 197, 94, 0.35)",
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 900, color: "#22C55E", letterSpacing: 4 }}>
                INVESTIGATION DOSSIER
              </div>
              <div style={{ fontSize: 44, fontWeight: 900, color: "#FFFFFF", marginTop: 10 }}>
                CASE CLOSED
              </div>
              <div style={{ fontSize: 16, color: "#94A3B8", letterSpacing: 2, marginTop: 12 }}>
                COUNTERMEASURES ENFORCED // 2026
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= 3. FILM GRAIN & SUBTLE VIGNETTE ================= */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 180px rgba(0,0,0,0.85)",
          pointerEvents: "none",
          mixBlendMode: "multiply",
        }}
      />

      {/* ================= 4. MINIMAL TOP EDITORIAL BADGE ================= */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 60,
          right: 60,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: frame % 24 < 12 ? "#EF4444" : "#7F1D1D",
            }}
          />
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 3, color: "#E2E8F0" }}>
            SPECIAL INVESTIGATION
          </span>
          <span style={{ fontSize: 15, color: "#94A3B8", letterSpacing: 1.5 }}>
            // FILE: NV-SPARK
          </span>
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: 2,
            color: "#94A3B8",
            padding: "4px 10px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: 6,
          }}
        >
          DOCUMENTARY
        </div>
      </div>

      {/* ================= 5. KINETIC WORD-BY-WORD CAPTIONS OVERLAY ================= */}
      <div
        style={{
          position: "absolute",
          bottom: 160,
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
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              borderRadius: 20,
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)",
              maxWidth: "96%",
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

      {/* ================= 6. PROGRESS INDICATOR ================= */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 60,
          right: 60,
          height: 6,
          backgroundColor: "rgba(255, 255, 255, 0.15)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(frame / 1500) * 100}%`,
            background: "linear-gradient(90deg, #76B900, #38BDF8, #EF4444)",
            borderRadius: 3,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export default NvidiaHoneytrapReel;
