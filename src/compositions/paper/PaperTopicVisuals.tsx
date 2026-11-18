import React from "react";
import { PaperSceneProps } from "../PaperExplainerReel";

// =============================================================================
// 1. TOPIC DOMAIN DETECTOR & SMART CLASSIFIER
// Accurately maps title or concept into a visual topic domain
// =============================================================================

export type TopicDomain =
  | "roman_concrete"
  | "mantis_shrimp"
  | "agarwood"
  | "refrigerator"
  | "ant_colony"
  | "cellular_exercise"
  | "airplane_physics"
  | "giant_sequoia"
  | "lightning_physics"
  | "money_compounding"
  | "space_astronomy"
  | "quantum_computing"
  | "human_biology"
  | "general_science";

export function getTopicDomain(title = "", concept = "", headline = ""): TopicDomain {
  const t = `${title} ${concept} ${headline}`.toLowerCase();

  // Explicit keyword checks ordered by specificity
  if (t.includes("concrete") || t.includes("rome") || t.includes("roman") || t.includes("pantheon") || t.includes("colosseum") || t.includes("pozzolan") || t.includes("quicklime") || t.includes("tobermorite") || t.includes("cracks")) {
    return "roman_concrete";
  }
  if (t.includes("shrimp") || t.includes("mantis") || t.includes("dactyl") || t.includes("cavitation") || (t.includes("punch") && t.includes("underwater"))) {
    return "mantis_shrimp";
  }
  if (t.includes("agarwood") || t.includes("oud") || t.includes("kynam") || t.includes("aquilaria") || (t.includes("wood") && t.includes("gold"))) {
    return "agarwood";
  }
  if (t.includes("refrigerator") || t.includes("cooling") || t.includes("refrigerant") || t.includes("joule-thomson")) {
    return "refrigerator";
  }
  if (t.includes("ant") || t.includes("colony") || t.includes("stigmergy") || t.includes("pheromone") || t.includes("superhighway")) {
    return "ant_colony";
  }
  if (t.includes("muscle") || t.includes("running") || t.includes("ampk") || t.includes("glut4") || t.includes("mitochondria") || t.includes("exercise")) {
    return "cellular_exercise";
  }
  if (t.includes("airplane") || t.includes("plane") || t.includes("airfoil") || t.includes("lift") || t.includes("bernoulli") || t.includes("flight")) {
    return "airplane_physics";
  }
  if (t.includes("sequoia") || (t.includes("tree") && t.includes("seed")) || t.includes("photosynthesis") || t.includes("biomass") || (t.includes("thin air") && t.includes("wood"))) {
    return "giant_sequoia";
  }
  if (t.includes("lightning") || t.includes("thunder") || t.includes("return stroke") || t.includes("stepped leader") || t.includes("electric charge")) {
    return "lightning_physics";
  }
  if (t.includes("rupee") || t.includes("save 10") || t.includes("saving 10") || t.includes("compound interest") || t.includes("cagr") || t.includes("geometric reinvestment") || t.includes("lakhs") || t.includes("invest ₹") || t.includes("bank deposit")) {
    return "money_compounding";
  }
  if (t.includes("space") || t.includes("rocket") || t.includes("orbit") || t.includes("gravity") || t.includes("planet") || t.includes("black hole")) {
    return "space_astronomy";
  }
  if (t.includes("quantum") || t.includes("qubit") || t.includes("superposition") || t.includes("entanglement")) {
    return "quantum_computing";
  }
  if (t.includes("dna") || t.includes("gene") || t.includes("brain") || t.includes("neuron") || t.includes("heart") || t.includes("blood")) {
    return "human_biology";
  }

  return "general_science";
}

// =============================================================================
// 2. DYNAMIC SCENE HERO VISUAL (MATCHES SCENE TEXT INTENTIONALLY!)
// Every scene gets customized paper layers, diagrams and technical badges
// =============================================================================

interface HeroVisualProps {
  domain: TopicDomain;
  scene: PaperSceneProps;
  sceneLocalFrame: number;
  highlightProgress: number;
}

export const PaperTopicHeroVisual: React.FC<HeroVisualProps> = ({
  domain,
  scene,
  sceneLocalFrame,
  highlightProgress,
}) => {
  const pulse = 1 + Math.sin(sceneLocalFrame * 0.08) * 0.025;
  const rotation = Math.sin(sceneLocalFrame * 0.05) * 1.2;

  // Extract smart scene visual indicators
  const icon = scene.heroIcon || getFallbackIcon(domain, scene.sceneNumber);
  const metric = scene.metricNumber || getDefaultMetric(domain, scene.sceneNumber);
  const label = scene.metricLabel || getDefaultLabel(domain, scene.sceneNumber);
  const specText = scene.documentHeadline || getSpecBadge(domain, scene.sceneNumber);

  // Determine color themes based on topic domain
  const theme = getTopicTheme(domain, scene.sceneNumber);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", position: "relative" }}>
      {/* Upper Layered 3D Paper Card */}
      <div
        style={{
          width: "94%",
          height: 320,
          background: theme.cardBackground,
          borderRadius: 20,
          border: `3.5px solid ${theme.cardBorder}`,
          boxShadow: `0 22px 55px ${theme.shadowColor}, inset 0 2px 4px rgba(255,255,255,0.7)`,
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
          transform: `scale(${pulse}) rotate(${rotation}deg)`,
        }}
      >
        {/* Background Radial Sunburst Aura (Layered Craft Texture) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.14,
            backgroundImage: `radial-gradient(circle at 50% 40%, ${theme.accentColor} 0%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />

        {/* Top Header Tag Row */}
        <div style={{ zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: theme.tagTextColor,
              backgroundColor: theme.tagBackground,
              padding: "4px 10px",
              borderRadius: 8,
              border: `1px solid ${theme.cardBorder}`,
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            {theme.categoryLabel}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: theme.statusTextColor,
              backgroundColor: theme.statusBackground,
              padding: "3px 9px",
              borderRadius: 8,
              letterSpacing: "0.5px",
            }}
          >
            {theme.statusText}
          </span>
        </div>

        {/* Center Hero Cutout Illustration */}
        <div style={{ zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", margin: "4px 0" }}>
          <div
            style={{
              fontSize: 82,
              filter: `drop-shadow(0 14px 22px ${theme.iconShadow})`,
              transform: `scale(${1 + Math.sin(sceneLocalFrame * 0.1) * 0.04})`,
              transition: "transform 0.1s ease-out",
            }}
          >
            {icon}
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: theme.titleColor,
              letterSpacing: "1px",
              marginTop: 6,
              fontFamily: "'Montserrat', sans-serif",
              textAlign: "center",
            }}
          >
            {metric}
          </div>
        </div>

        {/* Bottom Technical Specification Pill */}
        <div
          style={{
            zIndex: 2,
            backgroundColor: theme.pillBackground,
            borderRadius: 12,
            border: `1.5px solid ${theme.pillBorder}`,
            padding: "8px 14px",
            width: "98%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", maxWidth: "70%" }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: theme.pillSubColor, letterSpacing: "1px", textTransform: "uppercase" }}>
              {theme.pillLabel}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: theme.pillTextColor,
                fontFamily: "'Courier New', Courier, monospace",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {theme.formulaOrSpec}
            </span>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 900,
              color: theme.verifiedBadgeColor,
              backgroundColor: theme.verifiedBadgeBg,
              padding: "3px 8px",
              borderRadius: 6,
              letterSpacing: "0.5px",
            }}
          >
            {theme.verifiedBadgeText}
          </span>
        </div>
      </div>

      {/* Floating Stamped Paper Ribbon Underneath */}
      <div
        style={{
          marginTop: -15,
          backgroundColor: theme.ribbonBg,
          color: theme.ribbonText,
          padding: "8px 26px",
          borderRadius: 12,
          border: `2px solid ${theme.ribbonBorder}`,
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: "1.5px",
          boxShadow: "0 10px 24px rgba(0,0,0,0.30)",
          transform: "rotate(-1deg)",
          textTransform: "uppercase",
          zIndex: 10,
          maxWidth: "88%",
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </div>
    </div>
  );
};

// =============================================================================
// 3. DYNAMIC DOSSIER GRAPHIC INFOGRAPHIC (LOWER HALF: 1100PX - 1860PX)
// Renders topic-accurate diagrams: Curves, Cavitations, Comparison bars, Scales
// =============================================================================

interface DossierGraphicProps {
  domain: TopicDomain;
  scene: PaperSceneProps;
}

export const PaperTopicDossierGraphic: React.FC<DossierGraphicProps> = ({ domain, scene }) => {
  // A. ROMAN CONCRETE: Durability Comparison (Modern Cracks in 50 Yrs vs Roman 2,000 Yrs)
  if (domain === "roman_concrete") {
    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          padding: "12px 14px",
          backgroundColor: "#F7F2E7",
          borderRadius: 14,
          border: "2px solid #C8B693",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: "#991B1B" }}>
            MODERN PORTLAND: CRACKS AT 50 YRS ⚠️
          </span>
          <span style={{ fontSize: 11, fontWeight: 900, color: "#15803D" }}>
            ROMAN CONCRETE: +2,000 YRS ROCK SOLID 🏛️
          </span>
        </div>

        <svg viewBox="0 0 500 100" style={{ width: "100%", height: 100, zIndex: 3 }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="romanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#15803D" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#15803D" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {/* Roman Concrete: Rising curve over 2,000 years */}
          <path d="M10,80 Q150,70 300,45 T490,15 L490,100 L10,100 Z" fill="url(#romanGrad)" />
          <path d="M10,80 Q150,70 300,45 T490,15" fill="none" stroke="#15803D" strokeWidth="4" />
          <circle cx="490" cy="15" r="6" fill="#15803D" />

          {/* Modern Concrete: Plummets at year 50 */}
          <path d="M10,40 Q100,42 160,95" fill="none" stroke="#DC2626" strokeWidth="3" strokeDasharray="5,5" />
          <circle cx="160" cy="95" r="5" fill="#DC2626" />
        </svg>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 800, color: "#78582C" }}>
          <span>YEAR 0 (CONSTRUCTION)</span>
          <span>YEAR 50 (COLLAPSE POINT)</span>
          <span>YEAR 2,000+ (STRONGER TODAY)</span>
        </div>
      </div>
    );
  }

  // B. MANTIS SHRIMP: Cavitation Pressure Shockwave vs Bullet Speed
  if (domain === "mantis_shrimp") {
    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          padding: "12px 14px",
          backgroundColor: "#F0F9FF",
          borderRadius: 14,
          border: "2px solid #BAE6FD",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: "#0369A1" }}>
            STRIKE ACCELERATION PULSE (OVER 10,000 G IN CAVITATION CHANNEL)
          </span>
          <span style={{ fontSize: 11, fontWeight: 900, color: "#EA580C" }}>
            TEMPERATURE: 4,700 K 💥
          </span>
        </div>

        <svg viewBox="0 0 500 90" style={{ width: "100%", height: 90 }} preserveAspectRatio="none">
          <path d="M10,80 L180,80 L200,10 L230,85 L280,75 L500,80" fill="none" stroke="#0284C7" strokeWidth="4" />
          <circle cx="200" cy="10" r="7" fill="#EA580C" />
          <text x="215" y="24" fontSize="11" fontWeight="bold" fill="#0F172A">1,500 N IMPACT FORCE</text>
        </svg>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 800, color: "#0284C7" }}>
          <span>T=0.0 ms (STRIKE LAUNCH)</span>
          <span>T=0.8 ms (CAVITATION COLLAPSE)</span>
          <span>T=2.0 ms (PREY CRACKED)</span>
        </div>
      </div>
    );
  }

  // C. GIANT SEQUOIA: Atmospheric Carbon Absorption Scale (95% air vs 5% soil)
  if (domain === "giant_sequoia") {
    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          padding: "12px 14px",
          backgroundColor: "#F0FDF4",
          borderRadius: 14,
          border: "2px solid #BBF7D0",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: "#166534" }}>
            ATMOSPHERIC CO₂ GAS MASS: 95% 🌲
          </span>
          <span style={{ fontSize: 11, fontWeight: 900, color: "#854D0E" }}>
            SOIL MINERALS: &lt;5% 🪨
          </span>
        </div>

        {/* Stacked Percentage Bar */}
        <div style={{ width: "100%", height: 32, backgroundColor: "#FEF08A", borderRadius: 8, display: "flex", overflow: "hidden", border: "2px solid #166534" }}>
          <div style={{ width: "95%", backgroundColor: "#15803D", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF", fontSize: 12, fontWeight: 900 }}>
            95% CARBON FROM AIR (PHOTOSYNTHESIS)
          </div>
          <div style={{ width: "5%", backgroundColor: "#78350F", display: "flex", alignItems: "center", justifyContent: "center", color: "#FEF3C7", fontSize: 9, fontWeight: 900 }}>
            SOIL
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 800, color: "#166534" }}>
          <span>INITIAL SEED: 3 MILLIGRAMS</span>
          <span>ATMOSPHERIC GAS ACCUMULATION</span>
          <span>FINAL TREE: 1,000+ TONS</span>
        </div>
      </div>
    );
  }

  // D. MONEY COMPOUNDING: Geometric Compounding Curve (₹10/day -> ₹12.8 Lakhs)
  if (domain === "money_compounding") {
    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          padding: "12px 14px",
          backgroundColor: "#FFFBEB",
          borderRadius: 14,
          border: "2px solid #FDE68A",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: "#854D0E" }}>
            YEAR 0 // ₹10 / DAY
          </span>
          <span style={{ fontSize: 11, fontWeight: 900, color: "#15803D" }}>
            YEAR 30 // ₹12.8 LAKHS ✓
          </span>
        </div>

        <svg viewBox="0 0 500 95" style={{ width: "100%", height: 95 }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="goldCompGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#EAB308" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#EAB308" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d="M10,80 Q250,75 380,50 T490,12 L490,95 L10,95 Z" fill="url(#goldCompGrad)" />
          <path d="M10,80 Q250,75 380,50 T490,12" fill="none" stroke="#CA8A04" strokeWidth="4" />
          <circle cx="490" cy="12" r="6" fill="#DC2626" />
        </svg>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 800, color: "#854D0E" }}>
          <span>PRINCIPAL: ₹1,09,500</span>
          <span>GEOMETRIC COMPOUNDING ACCELERATION</span>
          <span>INTEREST: ₹11,70,000+</span>
        </div>
      </div>
    );
  }

  // E. UNIVERSAL DYNAMIC DOSSIER GRAPHIC (For Any Science, Physics, History or Biology Topic)
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        padding: "12px 14px",
        backgroundColor: "#F8FAFC",
        borderRadius: 14,
        border: "2px solid #CBD5E1",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: "#0F172A" }}>
          📊 {scene.metricLabel || "EMPIRICAL PARAMETER DISTRIBUTION"}
        </span>
        <span style={{ fontSize: 11, fontWeight: 900, color: "#0284C7" }}>
          {scene.metricNumber || "100% VERIFIED"}
        </span>
      </div>

      <svg viewBox="0 0 500 85" style={{ width: "100%", height: 85 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="univGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0284C7" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0284C7" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d="M10,75 Q150,65 260,40 T490,18 L490,85 L10,85 Z" fill="url(#univGrad)" />
        <path d="M10,75 Q150,65 260,40 T490,18" fill="none" stroke="#0284C7" strokeWidth="4" />
        <circle cx="490" cy="18" r="6" fill="#0284C7" />
      </svg>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 800, color: "#475569" }}>
        <span>BASELINE INPUT</span>
        <span>VERIFIED EMPIRICAL MECHANISM</span>
        <span>PEAK RESULT</span>
      </div>
    </div>
  );
};

// =============================================================================
// HELPER METHODS: DYNAMIC THEMES & METRICS
// =============================================================================

function getFallbackIcon(domain: TopicDomain, sceneNum: number): string {
  switch (domain) {
    case "roman_concrete":
      return sceneNum === 1 ? "🏛️" : sceneNum === 2 ? "🧪" : "🗿";
    case "mantis_shrimp":
      return sceneNum === 1 ? "🦐" : sceneNum === 2 ? "💥" : "⚡";
    case "giant_sequoia":
      return sceneNum === 1 ? "🌱" : sceneNum === 2 ? "☁️" : "🌲";
    case "money_compounding":
      return sceneNum === 1 ? "🪙" : sceneNum === 2 ? "📊" : "🌳";
    case "airplane_physics":
      return sceneNum === 1 ? "✈️" : sceneNum === 2 ? "💨" : "📐";
    case "lightning_physics":
      return sceneNum === 1 ? "🌩️" : sceneNum === 2 ? "⚡" : "🌡️";
    case "refrigerator":
      return sceneNum === 1 ? "❄️" : sceneNum === 2 ? "🔄" : "🧊";
    case "ant_colony":
      return sceneNum === 1 ? "🐜" : sceneNum === 2 ? "🛣️" : "👑";
    case "cellular_exercise":
      return sceneNum === 1 ? "🏃" : sceneNum === 2 ? "⚡" : "🧬";
    case "space_astronomy":
      return sceneNum === 1 ? "🚀" : sceneNum === 2 ? "🪐" : "🌌";
    default:
      return sceneNum === 1 ? "🔬" : sceneNum === 2 ? "📑" : "🎯";
  }
}

function getDefaultMetric(domain: TopicDomain, sceneNum: number): string {
  switch (domain) {
    case "roman_concrete":
      return sceneNum === 1 ? "2,000+ YEARS" : sceneNum === 2 ? "LIME CLAST REACTION" : "Al-Tobermorite";
    case "mantis_shrimp":
      return sceneNum === 1 ? "80 KM / H" : sceneNum === 2 ? "10,000 G ACCEL" : "4,700 K HEAT";
    case "giant_sequoia":
      return sceneNum === 1 ? "3 MILLIGRAMS" : sceneNum === 2 ? "95% AIR MASS" : "1,000 TONS";
    case "money_compounding":
      return sceneNum === 1 ? "₹10 / DAY" : sceneNum === 2 ? "₹1,09,500" : "₹12,80,000+";
    default:
      return sceneNum === 1 ? "PHASE 1" : sceneNum === 2 ? "EMPIRICAL SPEC" : "100% VERIFIED";
  }
}

function getDefaultLabel(domain: TopicDomain, sceneNum: number): string {
  switch (domain) {
    case "roman_concrete":
      return sceneNum === 1 ? "🏛️ ANCIENT SEAWATER FORMULA" : sceneNum === 2 ? "🔬 TOBERMORITE CRYSTAL SEALS" : "🗿 ROCK-SOLID STONE MONOLITH";
    case "mantis_shrimp":
      return sceneNum === 1 ? "💥 BULLET-SPEED STRIKE" : sceneNum === 2 ? "⚡ CAVITATION BUBBLE BURST" : "🎯 SONIC FORCE IMPACT";
    case "giant_sequoia":
      return sceneNum === 1 ? "🌱 MICROSCOPIC SEED" : sceneNum === 2 ? "☁️ ATMOSPHERIC CARBON ABSORPTION" : "🌲 MASSIVE WOOD CANOPY";
    case "money_compounding":
      return sceneNum === 1 ? "🪙 INITIAL SAVINGS BEAT" : sceneNum === 2 ? "📊 30-YEAR TOTAL CAPITAL" : "🚀 COMPOUND WEALTH MULTIPLIER";
    default:
      return "🔬 SCIENTIFIC INVESTIGATION";
  }
}

function getSpecBadge(domain: TopicDomain, sceneNum: number): string {
  switch (domain) {
    case "roman_concrete":
      return sceneNum === 1 ? "OPUS CAEMENTICIUM // POZZOLANA" : sceneNum === 2 ? "SELF-HEALING CRACK DISSOLUTION" : "Ca₅Si₆O₁₆(OH)₂ // MIT VERIFIED";
    case "mantis_shrimp":
      return "DACTYL CLUB ACCELERATION";
    case "giant_sequoia":
      return "CARBON FIXATION // PHOTOSYNTHESIS";
    case "money_compounding":
      return "A = P · (1 + r/n)ⁿᵗ";
    default:
      return "QUANTITATIVE EMPIRICAL PROOF";
  }
}

interface TopicTheme {
  cardBackground: string;
  cardBorder: string;
  shadowColor: string;
  accentColor: string;
  tagBackground: string;
  tagBorder?: string;
  tagTextColor: string;
  statusBackground: string;
  statusTextColor: string;
  statusText: string;
  categoryLabel: string;
  titleColor: string;
  iconShadow: string;
  pillBackground: string;
  pillBorder: string;
  pillLabel: string;
  pillSubColor: string;
  formulaOrSpec: string;
  pillTextColor: string;
  verifiedBadgeText: string;
  verifiedBadgeBg: string;
  verifiedBadgeColor: string;
  ribbonBg: string;
  ribbonBorder: string;
  ribbonText: string;
}

function getTopicTheme(domain: TopicDomain, sceneNum: number): TopicTheme {
  if (domain === "roman_concrete") {
    return {
      cardBackground: "radial-gradient(circle at 50% 35%, #FFFBF2 0%, #EFE5D1 60%, #D8C7A5 100%)",
      cardBorder: "#C4B088",
      shadowColor: "rgba(110, 85, 45, 0.35)",
      accentColor: "#D8C7A5",
      tagBackground: "#F5ECD7",
      tagTextColor: "#78582C",
      statusBackground: "#DCFCE7",
      statusTextColor: "#166534",
      statusText: "2,000+ YRS ACTIVE",
      categoryLabel: "🏛️ ROMAN ARCHITECTURE",
      titleColor: "#45321A",
      iconShadow: "rgba(0,0,0,0.25)",
      pillBackground: "rgba(45, 32, 18, 0.92)",
      pillBorder: "#C4B088",
      pillLabel: "MINERAL SPECIFICATION",
      pillSubColor: "#FDE047",
      formulaOrSpec: sceneNum === 3 ? "Al-Tobermorite [Ca₅Si₆O₁₆(OH)₂]" : "Opus Caementicium (Pozzolana + Lime)",
      pillTextColor: "#FFFFFF",
      verifiedBadgeText: "MIT VERIFIED",
      verifiedBadgeBg: "#166534",
      verifiedBadgeColor: "#86EFAC",
      ribbonBg: "#78582C",
      ribbonBorder: "#C4B088",
      ribbonText: "#FFFDF5",
    };
  }

  if (domain === "money_compounding") {
    return {
      cardBackground: "radial-gradient(circle at 50% 30%, #FEF9C3 0%, #FEF08A 45%, #FDE68A 100%)",
      cardBorder: "#EAB308",
      shadowColor: "rgba(234, 179, 8, 0.35)",
      accentColor: "#EAB308",
      tagBackground: "#FEF3C7",
      tagTextColor: "#854D0E",
      statusBackground: "#DCFCE7",
      statusTextColor: "#15803D",
      statusText: "+1,170% PROFIT",
      categoryLabel: "💰 FINANCIAL MATHEMATICS",
      titleColor: "#14532D",
      iconShadow: "rgba(234, 179, 8, 0.5)",
      pillBackground: "rgba(28, 20, 12, 0.92)",
      pillBorder: "#EAB308",
      pillLabel: "COMPOUNDING FORMULA",
      pillSubColor: "#FDE047",
      formulaOrSpec: "A = P · (1 + r/n)ⁿᵗ",
      pillTextColor: "#FFFFFF",
      verifiedBadgeText: "12% HISTORIC CAGR",
      verifiedBadgeBg: "#15803D",
      verifiedBadgeColor: "#86EFAC",
      ribbonBg: "#15803D",
      ribbonBorder: "#86EFAC",
      ribbonText: "#FEF08A",
    };
  }

  if (domain === "giant_sequoia") {
    return {
      cardBackground: "radial-gradient(circle at 50% 35%, #F0FDF4 0%, #DCFCE7 55%, #BBF7D0 100%)",
      cardBorder: "#22C55E",
      shadowColor: "rgba(34, 197, 94, 0.30)",
      accentColor: "#22C55E",
      tagBackground: "#DCFCE7",
      tagTextColor: "#166534",
      statusBackground: "#FEF3C7",
      statusTextColor: "#854D0E",
      statusText: "95% AIR DERIVED",
      categoryLabel: "🌲 BOTANICAL BIOCHEMISTRY",
      titleColor: "#14532D",
      iconShadow: "rgba(20, 83, 45, 0.3)",
      pillBackground: "rgba(20, 83, 45, 0.92)",
      pillBorder: "#4ADE80",
      pillLabel: "PHOTOSYNTHESIS REACTION",
      pillSubColor: "#FDE047",
      formulaOrSpec: "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂",
      pillTextColor: "#FFFFFF",
      verifiedBadgeText: "HARVARD VERIFIED",
      verifiedBadgeBg: "#166534",
      verifiedBadgeColor: "#86EFAC",
      ribbonBg: "#166534",
      ribbonBorder: "#4ADE80",
      ribbonText: "#F0FDF4",
    };
  }

  if (domain === "mantis_shrimp") {
    return {
      cardBackground: "radial-gradient(circle at 50% 35%, #F0F9FF 0%, #E0F2FE 55%, #BAE6FD 100%)",
      cardBorder: "#0284C7",
      shadowColor: "rgba(2, 132, 199, 0.35)",
      accentColor: "#0284C7",
      tagBackground: "#E0F2FE",
      tagTextColor: "#0369A1",
      statusBackground: "#FEE2E2",
      statusTextColor: "#B91C1C",
      statusText: "10,000 G STRIKE",
      categoryLabel: "🦐 BIOMECHANICS & PHYSICS",
      titleColor: "#0C4A6E",
      iconShadow: "rgba(2, 132, 199, 0.4)",
      pillBackground: "rgba(12, 74, 110, 0.94)",
      pillBorder: "#38BDF8",
      pillLabel: "CAVITATION ACOUSTICS",
      pillSubColor: "#38BDF8",
      formulaOrSpec: "P_collapse > 1,500 N (T=4,700K)",
      pillTextColor: "#FFFFFF",
      verifiedBadgeText: "UC BERKELEY VERIFIED",
      verifiedBadgeBg: "#0369A1",
      verifiedBadgeColor: "#E0F2FE",
      ribbonBg: "#0369A1",
      ribbonBorder: "#38BDF8",
      ribbonText: "#FFFFFF",
    };
  }

  // Universal Science & Engineering Default
  return {
    cardBackground: "radial-gradient(circle at 50% 30%, #F8FAFC 0%, #EEF2F6 55%, #E2E8F0 100%)",
    cardBorder: "#94A3B8",
    shadowColor: "rgba(71, 85, 105, 0.30)",
    accentColor: "#38BDF8",
    tagBackground: "#F1F5F9",
    tagTextColor: "#334155",
    statusBackground: "#CCFBF1",
    statusTextColor: "#0F766E",
    statusText: "PEER-REVIEWED",
    categoryLabel: "📑 SCIENTIFIC INVESTIGATION",
    titleColor: "#0F172A",
    iconShadow: "rgba(0,0,0,0.20)",
    pillBackground: "rgba(15, 23, 42, 0.90)",
    pillBorder: "#64748B",
    pillLabel: "EMPIRICAL SPECIFICATION",
    pillSubColor: "#FDE047",
    formulaOrSpec: "100% QUANTITATIVE PROOF",
    pillTextColor: "#FFFFFF",
    verifiedBadgeText: "EMPIRICAL SPEC",
    verifiedBadgeBg: "#0F172A",
    verifiedBadgeColor: "#38BDF8",
    ribbonBg: "#0F172A",
    ribbonBorder: "#38BDF8",
    ribbonText: "#F8FAFC",
  };
}
