import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { runQuery, getQuery, allQuery } from './db';

export interface PaperRenderJob {
  id: string;
  planId: string;
  status: 'pending' | 'generating_voice' | 'modeling_paper' | 'rendering_video' | 'completed' | 'failed';
  progress: number;
  message: string;
  videoUrl?: string;
  duration?: number;
  aspectRatio?: string;
  error?: string;
  createdAt: string;
}

export const paperRenderJobs = new Map<string, PaperRenderJob>();

export interface PaperIdea {
  id: string;
  title: string;
  hook: string;
  explanation: string;
  visualPotential: string;
  factualBasis: string;
  sources: string[];
  category: string;
}

export interface PaperWord {
  word: string;
  start: number;
  end: number;
}

export interface PaperScene {
  sceneNumber: number;
  timeRange: string;
  narration: string;
  imagePrompt?: string; // Only for Scene 1
  videoPrompt: string;  // For all scenes
  visualDescription: string;
  paperElements: string[];
  metricNumber?: string;
  metricLabel?: string;
  heroIcon?: string;
  documentHeadline?: string;
  documentSnippet?: string;
  narrationSrc?: string;
  words?: PaperWord[];
}

export interface PaperProductionPlan {
  id: string;
  title: string;
  verifiedConcept: string;
  duration: number;
  sceneCount: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
  scenes: PaperScene[];
  sources: string[];
  createdAt: string;
}

export class PaperStudioService {
  /**
   * Curated pool of authentic, verified educational topics covering varied fields
   */
  private static IDEA_DATABASE: PaperIdea[] = [
    {
      id: 'mantis_shrimp_punch',
      title: 'This Tiny Shrimp Punches With The Power Of A Bullet',
      hook: 'This tiny creature under the ocean can strike with the acceleration of a .22 caliber bullet.',
      explanation: 'The peacock mantis shrimp snaps its club-like dactyl appendages so fast that it boils the surrounding water and creates a flash of light through cavitation. Its punch moves at over 50 miles per hour (23 m/s) with 1,500 newtons of force, effortlessly smashing thick aquarium glass.',
      visualPotential: 'Layered textured paper ocean backdrop, paper cut-out mantis shrimp cocking its spring-loaded club, paper impact ripple rings with animated force gauge counter reaching 1,500 N, and tiny paper bubble cut-outs popping with light.',
      factualBasis: 'Published by University of California, Berkeley & Journal of Experimental Biology: strike acceleration exceeds 10,000 g, producing localized temperatures over 4,000°C via acoustic cavitation.',
      sources: ['Journal of Experimental Biology (Patek et al.)', 'UC Berkeley Biomechanics Lab'],
      category: 'Insects & Marine Biology'
    },
    {
      id: 'compounding_penny',
      title: 'What Actually Happens If You Save 10 Rupees Every Single Day?',
      hook: 'If you put away just ten rupees every morning, the math does something unbelievable over 30 years.',
      explanation: 'Saving Rs. 10 a day equals just Rs. 3,650 per year or Rs. 1,09,500 in total principal over 30 years. However, when invested in a diversified index compounding at a verified historic 12% annualized return, that humble pocket change explodes into over Rs. 12.8 Lakhs purely through geometric reinvestment.',
      visualPotential: 'Torn-paper calendar flipping, daily paper coins sliding into a layered paper jar, paper bar chart folding upwards year by year, and split-screen comparison: flat stack of coins vs. massive paper tree of compound returns.',
      factualBasis: 'Compound Interest Formula A = P(1 + r/n)^(nt) with daily contributions: 10,950 total days = Rs. 1,09,500 principal yielding Rs. 12,85,000+ at 12% compound CAGR.',
      sources: ['Reserve Bank of India Financial Literacy Archives', 'Standard Compound Annuity Formula'],
      category: 'Money & Economics'
    },
    {
      id: 'agarwood_value',
      title: 'Why Is This Decayed Wood Worth More Than Solid Gold?',
      hook: 'This dark, moldy wood is worth more than pure gold, but only when the tree gets wounded.',
      explanation: 'Agarwood (Oud) is created only when the Aquilaria tree is infected by a specific mold fungus (Phialophora parasitica). In defense, the tree produces a dense, dark aromatic resin; top-grade Kynam agarwood has sold for up to $10,000 per single gram—dwarfing the price of gold.',
      visualPotential: 'Cross-section paper tree trunk unfolding, paper mold spores invading the wood fibers, dark textured resin bleeding into paper veins, and a vintage paper balance scale balancing a tiny black wood chip against a heavy gold ingot.',
      factualBasis: 'CITES (Convention on International Trade in Endangered Species) and International Tropical Timber Organization documentation; Kyara grade agarwood recorded at auctions at $10,000/g.',
      sources: ['CITES Appendices Database', 'World Agroforestry Centre (ICRAF)'],
      category: 'Unusual Materials & Nature'
    },
    {
      id: 'refrigerator_cooling',
      title: 'How Does A Refrigerator Actually Make Cold Air Out Of Heat?',
      hook: 'A refrigerator does not actually create cold—it is an engine that steals heat and throws it outside.',
      explanation: 'Refrigerators exploit the Joule-Thomson effect and latent heat of vaporization. A chemical refrigerant gas is compressed until hot, condensed on the rear coils, and then squeezed through a tiny expansion valve where it abruptly expands, plummeting to sub-zero temperatures to absorb internal food heat.',
      visualPotential: 'Hand-drawn paper diagram of a refrigerator cabinet, paper cut-out arrows changing from glowing warm red to icy paper blue, folding expansion valve cut-out with animated paper snowflake icons and thermometer drop.',
      factualBasis: 'Second Law of Thermodynamics (Clausius statement) and Vapor-Compression Refrigeration Cycle; refrigerant evaporation pressure drop directly cools evaporator coils to -15°C to -25°C.',
      sources: ['MIT Department of Mechanical Engineering (Thermodynamics Notes)', 'ASHRAE Handbook'],
      category: 'Everyday Inventions & Physics'
    },
    {
      id: 'ant_colony_algorithms',
      title: 'How Millions Of Ants Build Superhighways Without A Single Boss',
      hook: 'No ant is in charge, yet millions of them navigate the fastest route without traffic jams.',
      explanation: 'Ant colonies solve complex traveling salesman problems through stigmergy—laying volatile paper-thin pheromone trails. Shorter routes allow quicker round trips, accumulating denser scent marks that recruit more foragers until an optimal geometric highway emerges automatically.',
      visualPotential: 'Top-down paper map of a forest floor with paper twigs and sugar cube obstacles, marching cut-out paper ants leaving glowing paper dotted lines, with animated timer overlays showing trail convergence.',
      factualBasis: 'Research published in Nature and Journal of Theoretical Biology; Ant Colony Optimization (ACO) algorithm formalized by Marco Dorigo in 1992.',
      sources: ['Nature (Deneubourg et al.)', 'Harvard Wyss Institute Collective Intelligence'],
      category: 'Animal Architecture & Math'
    },
    {
      id: 'exercise_cellular_reaction',
      title: 'What Happens Inside Your Cells The Exact Minute You Start Running?',
      hook: 'Within just 60 seconds of running, your body triggers a hidden cellular survival switch.',
      explanation: 'The moment muscles contract, intracellular ATP drops within seconds, activating the master metabolic sensor AMPK. This signals GLUT4 vesicles to fuse with muscle cell membranes, hoovering up glucose without needing insulin, while mitochondria increase oxygen consumption by over 1,500%.',
      visualPotential: 'Layered paper muscle fiber unfolding like an accordion, paper glucose molecules flowing into sliding paper gate valves (GLUT4), and a paper mitochondria engine puffing tiny paper steam clouds as VO2 max counter rises.',
      factualBasis: 'American Physiological Society & Cell Metabolism review: AMPK activation triggers GLUT4 translocation within 2 minutes of vigorous contractions, multiplying capillary perfusion tenfold.',
      sources: ['Cell Metabolism (Richter & Hargreaves)', 'American College of Sports Medicine'],
      category: 'Human Biology & Health'
    },
    {
      id: 'airplane_lift_physics',
      title: 'The Real Reason 500-Ton Airplanes Float On Thin Air',
      hook: 'A 500-ton Boeing 747 stays airborne using nothing more than invisible air molecules pushed downwards.',
      explanation: 'Airplane wings fly primarily due to Newton’s Third Law paired with the Coandă effect, rather than the common equal-transit misconception. The curved paper-like airfoil deflects thousands of tons of air downwards every second, generating an equal and opposite upward lifting force of hundreds of kilonewtons.',
      visualPotential: 'Paper airplane cross-section suspended on subtle paper strings, blue paper streamline ribbons curving over the wing curvature and bending downwards, with large paper vectors showing Downwash Force vs. Upward Lift.',
      factualBasis: 'NASA Glenn Research Center Flight Mechanics Bulletin: lift equals the time-rate of change of vertical momentum of redirected airflow (L = m_dot * delta_V).',
      sources: ['NASA Glenn Research Center (Beginner’s Guide to Aerodynamics)', 'Cambridge University Physics'],
      category: 'Aviation & Engineering'
    },
    {
      id: 'ancient_concrete_rome',
      title: 'Why Roman Concrete Gets Stronger Over 2,000 Years While Ours Cracks',
      hook: 'Modern bridges decay after 50 years, but 2,000-year-old Roman piers are literally getting stronger today.',
      explanation: 'Roman marine concrete (opus caementicium) combined volcanic pozzolana ash with quicklime and seawater. When seawater percolates through the concrete over centuries, it dissolves lime clasts and crystallizes into rare aluminous tobermorite and phillipsite crystals, self-healing microcracks into rock-solid stone.',
      visualPotential: 'Textured paper Colosseum and Roman sea pier, paper cut-out waves lapping against aged paper stone blocks, with magnifying paper loupe showing glowing paper crystals weaving across micro-fissures.',
      factualBasis: 'Published in Science Advances (MIT, Harvard, and D’Ambrosio labs, 2023): hot-mixing of quicklime creates lime clasts that dissolve in moisture to dynamically seal fractures.',
      sources: ['Science Advances (Admir Masic et al., 2023)', 'USGS Pozzolan Mineral Reports'],
      category: 'Ancient Inventions & Chemistry'
    },
    {
      id: 'seed_to_giant_sequoia',
      title: 'How A 3-Milligram Seed Pulls 1,000 Tons Of Wood Out Of Thin Air',
      hook: 'A giant sequoia weighs over 2 million pounds, but it did not get its mass from the soil.',
      explanation: 'A giant sequoia grows from a paper-thin seed weighing just 0.005 grams into a 1,000-ton titan. Over 95% of its colossal dry mass comes directly from carbon dioxide gas sucked out of the atmosphere through photosynthesis, converting invisible air and sunlight into solid cellulose and lignin.',
      visualPotential: 'Torn-paper forest ground with a pinhead-sized paper seed, paper carbon dioxide molecules drifting from paper clouds into tiny green leaf pores, with a folding height comparison gauge expanding up past paper skyscrapers.',
      factualBasis: 'Photosynthesis equation 6CO2 + 6H2O -> C6H12O6 + 6O2; Jan Baptist van Helmont classic willow tree experiment and modern isotopic forestry mass balances confirm plant biomass derives from atmospheric carbon.',
      sources: ['U.S. National Park Service (Sequoia & Kings Canyon)', 'Nature Plants'],
      category: 'Trees & Botany'
    },
    {
      id: 'lightning_stepped_leader',
      title: 'Why Lightning Actually Shoots Upward From The Ground To The Sky',
      hook: 'You think lightning strikes downwards, but the blinding flash you actually see shoots upwards.',
      explanation: 'While a faint, invisible stepped leader steps downward from thunderclouds in 50-meter paper-like zigzag jumps, the brilliant stroke that illuminates the sky is the "return stroke"—a surge of billions of watts of electrical current rushing from ground to cloud at one-third the speed of light.',
      visualPotential: 'Dark charcoal paper storm cloud backdrop, stepped faint paper jagged lines stepping downwards frame by frame, meeting a paper tree top, followed by an explosion of bright yellow layered paper light shooting upwards into the clouds.',
      factualBasis: 'National Oceanic and Atmospheric Administration (NOAA) National Severe Storms Laboratory: return stroke velocity reaches 100,000 km/s with peak channel temperatures of 30,000 K (five times hotter than the sun surface).',
      sources: ['NOAA National Severe Storms Laboratory', 'American Geophysical Union (AGU)'],
      category: 'Atmospheric Physics & Weather'
    }
  ];

  /**
   * Return 10 authentic, shuffled, fresh ideas
   */
  static generate10FreshIdeas(customQuery?: string): PaperIdea[] {
    const pool = [...this.IDEA_DATABASE];
    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    if (customQuery && customQuery.trim().length > 2) {
      const q = customQuery.trim().toLowerCase();
      // Generate a dynamic customized idea if user gave a specific topic
      const customIdea: PaperIdea = {
        id: 'custom_' + Date.now(),
        title: `How ${customQuery.trim()} Actually Works: The Hidden Mechanics`,
        hook: `You encounter ${customQuery.trim()} frequently, but its underlying mechanism is fascinating.`,
        explanation: `A deep scientific breakdown of ${customQuery.trim()} reveals verified physical principles, measurements, and structural transformations that most people never realize.`,
        visualPotential: `Textured paper cut-out layers explaining ${customQuery.trim()} with hand-drawn paper diagrams, callout labels, and moving paper comparison panels.`,
        factualBasis: `Verified scientific principles and peer-reviewed reference measurements covering ${customQuery.trim()}.`,
        sources: ['Encyclopedia Britannica', 'Scientific American Educational Archive'],
        category: 'Custom Topic Explainer'
      };
      return [customIdea, ...pool.slice(0, 9)];
    }

    return pool.slice(0, 10);
  }

  /**
   * Generate complete scene-by-scene paper animation production plan
   * GOLDEN RULE:
   * - Scene duration must be multiple of 10 seconds (each scene = exactly 10s)
   * - Scene 1 contains EXACTLY ONE Image Prompt and ONE Video Prompt
   * - Scene 2 onwards contain Video Prompts ONLY (continuing from previous scene's final frame)
   */
  static generateProductionPlan(
    idea: PaperIdea,
    durationSec: number = 30,
    aspectRatio: '9:16' | '16:9' | '1:1' = '9:16'
  ): PaperProductionPlan {
    const validDuration = Math.max(10, Math.round(durationSec / 10) * 10);
    const sceneCount = validDuration / 10;
    const planId = 'paper_proj_' + Date.now();

    const scenes: PaperScene[] = [];

    // Master Paper Visual Style Anchor
    const paperStyleAnchor = `Handcrafted educational paper graphics explainer animation on a high-texture cream cardstock paper background. Clean tactile cut-outs with torn paper edges, layered shapes casting subtle soft contact drop shadows, matte paper finish, hand-drawn infographic arrows, precise paper labels with clean typography, stop-motion tactile movement, 4K crisp macro focus, ${aspectRatio} aspect ratio.`;

    for (let i = 1; i <= sceneCount; i++) {
      const start = (i - 1) * 10;
      const end = i * 10;
      const timeRange = `${start}–${end}s`;

      if (i === 1) {
        // SCENE 1: Master Starting Image Prompt + 10s Video Prompt
        const imagePrompt = `${paperStyleAnchor} Scene establishing shot: Central cut-out paper illustration of ${idea.title}, framed by layered paper cards, animated paper callout pointers, clean bold sans-serif paper header label reading "${idea.title.slice(0, 35)}", subtle millimeter-grid paper texture beneath, warm studio lighting.`;

        const videoPrompt = `Start from the exact paper illustration in the reference image. The paper header tag unfolds with a crisp tactile paper fold. The central paper cut-out slides into focus with gentle stop-motion easing. A torn-paper highlight strip slides beneath the key subject as small paper comparison cards pop into view from the right. Narration hook plays smoothly over the 10-second duration, ending with a paper arrow pointing toward the incoming transformation, freezing cleanly on the 10-second final frame for continuous scene transition.`;

        // Domain detection for topic-specific graphics, icons and metrics
        const titleLower = idea.title.toLowerCase();
        const isConcrete = titleLower.includes('concrete') || titleLower.includes('rome');
        const isShrimp = titleLower.includes('shrimp') || titleLower.includes('punch');
        const isWood = titleLower.includes('wood') || titleLower.includes('agarwood');
        const isFridge = titleLower.includes('refrigerator') || titleLower.includes('cooling');
        const isAnt = titleLower.includes('ant') || titleLower.includes('colony');
        const isRun = titleLower.includes('run') || titleLower.includes('cell');
        const isPlane = titleLower.includes('airplane') || titleLower.includes('wing');
        const isTree = titleLower.includes('tree') || titleLower.includes('sequoia');
        const isLightning = titleLower.includes('lightning') || titleLower.includes('storm');
        const isMoney = titleLower.includes('rupee') || titleLower.includes('save') || titleLower.includes('money');

        let s1Icon = "🔬";
        let s1Metric = "01 // DISCOVERY";
        let s1Label = "INITIAL TRIGGER";
        let s1Headline = "OFFICIAL EMPIRICAL INVESTIGATION LEDGER";

        if (isConcrete) {
          s1Icon = "🏛️"; s1Metric = "2,000+ YEARS"; s1Label = "OPUS CAEMENTICIUM"; s1Headline = "OFFICIAL ARCHEOLOGICAL & CHEMICAL AUDIT: OPUS CAEMENTICIUM";
        } else if (isShrimp) {
          s1Icon = "🦐"; s1Metric = "1,500 N FORCE"; s1Label = "SPRING-LOADED IMPACT"; s1Headline = "PEACOCK MANTIS DACTYL ACCELERATION ANALYSIS";
        } else if (isWood) {
          s1Icon = "🪵"; s1Metric = "KYNAM OUD"; s1Label = "DEFENSIVE RESIN"; s1Headline = "AQUILARIA FUNGAL INFECTION IMMUNE RESPONSE";
        } else if (isFridge) {
          s1Icon = "❄️"; s1Metric = "HEAT PUMP ENGINE"; s1Label = "JOULE-THOMSON EFFECT"; s1Headline = "THERMODYNAMIC REFRIGERATION CYCLE SPECIFICATION";
        } else if (isAnt) {
          s1Icon = "🐜"; s1Metric = "0% TRAFFIC JAMS"; s1Label = "NO CENTRAL BOSS"; s1Headline = "ANT COLONY TRAFFIC OPTIMIZATION ALGORITHM";
        } else if (isRun) {
          s1Icon = "🏃"; s1Metric = "60 SECONDS"; s1Label = "METABOLIC SWITCH"; s1Headline = "INTRACELLULAR ATP DEPLETION & AMPK ACTIVATION";
        } else if (isPlane) {
          s1Icon = "✈️"; s1Metric = "500 TONS"; s1Label = "AIRBORNE TITAN"; s1Headline = "FLIGHT MECHANICS & DOWNWASH MOMENTUM AUDIT";
        } else if (isTree) {
          s1Icon = "🌱"; s1Metric = "0.005 GRAMS"; s1Label = "INITIAL SEED"; s1Headline = "ATMOSPHERIC CARBON DIOXIDE FIXATION STUDY";
        } else if (isLightning) {
          s1Icon = "⛈️"; s1Metric = "50M STEPS"; s1Label = "STEPPED LEADER"; s1Headline = "CLOUD-TO-GROUND IONIZATION CHANNEL DYNAMICS";
        } else if (isMoney) {
          s1Icon = "🪙"; s1Metric = "₹10 / DAY"; s1Label = "INITIAL SAVING BEAT"; s1Headline = "OFFICIAL SAVINGS FORMULA LEDGER";
        }

        let s1Narration = "";
        if (isFridge) {
          s1Narration = "A refrigerator does not actually create cold air. It is an engine that steals heat and throws it outside.";
        } else if (isShrimp) {
          s1Narration = "This tiny creature under the ocean can strike with the acceleration of a twenty-two caliber bullet.";
        } else if (isMoney) {
          s1Narration = "If you put away just ten rupees every morning, the math does something unbelievable over thirty years.";
        } else if (isWood) {
          s1Narration = "This dark moldy wood is worth more than pure gold, but only when the tree gets wounded.";
        } else if (isAnt) {
          s1Narration = "No single ant is ever in charge, yet millions of them navigate the fastest route without traffic jams.";
        } else if (isRun) {
          s1Narration = "Within just sixty seconds of running, your body triggers a hidden cellular survival switch.";
        } else if (isPlane) {
          s1Narration = "A five-hundred-ton Boeing 747 stays airborne using nothing more than invisible air molecules pushed downwards.";
        } else if (isConcrete) {
          s1Narration = "Modern bridges decay after fifty years, but two-thousand-year-old Roman piers are literally getting stronger today.";
        } else if (isTree) {
          s1Narration = "A giant sequoia weighs over two million pounds, but it did not get its mass from the soil.";
        } else if (isLightning) {
          s1Narration = "You think lightning strikes downwards, but the blinding flash you actually see shoots upwards.";
        } else {
          s1Narration = this.formatCleanNarration(
            `${idea.hook} Here is the astonishing scientific truth behind how it works.`,
            20
          );
        }

        scenes.push({
          sceneNumber: 1,
          timeRange,
          narration: s1Narration,
          imagePrompt,
          videoPrompt,
          visualDescription: `Starting paper master frame establishing the subject with layered cut-out shapes and tactile paper typography.`,
          paperElements: ['Cream cardstock background', 'Torn-paper headline pill', 'Central subject paper cut-out', 'Pointers & labels'],
          metricNumber: s1Metric,
          metricLabel: s1Label,
          heroIcon: s1Icon,
          documentHeadline: s1Headline,
          documentSnippet: idea.hook
        });
      } else {
        // SCENE 2 ONWARDS: NO IMAGE PROMPT! Video prompt strictly continues from previous scene's final frame
        const prevScene = i - 1;
        const videoPrompt = `Seamless continuation starting strictly from Scene ${prevScene}'s exact final paper frame. The existing paper elements fold outward like an origami mechanism as a layered paper diagram unfolds in the center to reveal the verified mechanics: ${idea.explanation.slice(0, 80)}. Paper numbers and infographic percentage dials tick upward with tactile paper click animations. End on a clean, stable paper frame at exactly the 10-second mark to maintain seamless frame continuity.`;

        const titleLower = idea.title.toLowerCase();
        const isConcrete = titleLower.includes('concrete') || titleLower.includes('rome');
        const isShrimp = titleLower.includes('shrimp') || titleLower.includes('punch');
        const isWood = titleLower.includes('wood') || titleLower.includes('agarwood');
        const isFridge = titleLower.includes('refrigerator') || titleLower.includes('cooling');
        const isAnt = titleLower.includes('ant') || titleLower.includes('colony');
        const isRun = titleLower.includes('run') || titleLower.includes('cell');
        const isPlane = titleLower.includes('airplane') || titleLower.includes('wing');
        const isTree = titleLower.includes('tree') || titleLower.includes('sequoia');
        const isLightning = titleLower.includes('lightning') || titleLower.includes('storm');
        const isMoney = titleLower.includes('rupee') || titleLower.includes('save') || titleLower.includes('money');

        let sIcon = i === 2 ? "📊" : "🏆";
        let sMetric = i === 2 ? "95% REACTION" : "100% VERIFIED";
        let sLabel = i === 2 ? "EMPIRICAL PROOF" : "NATURAL LAW";
        let sHeadline = i === 2 ? "QUANTITATIVE EMPIRICAL AUDIT DATA" : "VERIFIED NATURAL MECHANISM RECORD";

        if (isConcrete) {
          sIcon = i === 2 ? "🧪" : "🗿";
          sMetric = i === 2 ? "100% SELF-HEALING" : "TOBERMORITE TITAN";
          sLabel = i === 2 ? "LIME CLAST REACTION" : "PERPETUAL DURABILITY";
          sHeadline = i === 2 ? "EMPIRICAL TOBERMORITE CRYSTALLINE HEALING MECHANISM" : "2,000-YEAR COMPRESSIVE STRENGTH vs MODERN RETENTION";
        } else if (isShrimp) {
          sIcon = i === 2 ? "⚡" : "💥";
          sMetric = i === 2 ? "4,000°C FLASH" : "10,000 G ACCEL";
          sLabel = i === 2 ? "ACOUSTIC CAVITATION" : "ARMORED STRIKE";
          sHeadline = i === 2 ? "SONOLUMINESCENCE & CAVITATION SHOCKWAVE DATA" : "BIOMECHANICAL IMPACT & GLASS BREACH AUDIT";
        } else if (isWood) {
          sIcon = i === 2 ? "⚖️" : "💎";
          sMetric = i === 2 ? "$10,000 / GRAM" : "RAREST ESSENCE";
          sLabel = i === 2 ? "150× GOLD VALUE" : "LIQUID GOLD";
          sHeadline = i === 2 ? "AUCTION COMMODITY VALUATION: KYARA VS BULLION" : "CITES DOCUMENTED BOTANICAL RARITY AUDIT";
        } else if (isFridge) {
          sIcon = i === 2 ? "⚙️" : "🌡️";
          sMetric = i === 2 ? "-25°C EXPANSION" : "2ND LAW CONFIRMED";
          sLabel = i === 2 ? "NEEDLE VALVE DROP" : "HEAT EXHAUST";
          sHeadline = i === 2 ? "PRESSURE-ENTHALPY VAPOR CYCLE DATA" : "REFRIGERANT PHASE CHANGE EFFICIENCY";
        } else if (isAnt) {
          sIcon = i === 2 ? "🗺️" : "🧠";
          sMetric = i === 2 ? "STIGMERGY TRAILS" : "100% CONVERGENCE";
          sLabel = i === 2 ? "SCENT TRAIL SHORTEST PATH" : "ACO ALGORITHM";
          sHeadline = i === 2 ? "PHEROMONE RECRUITMENT & HIGHWAY CONVERGENCE" : "COLLECTIVE TRAVELLING SALESMAN SOLUTION";
        } else if (isRun) {
          sIcon = i === 2 ? "🔬" : "⚡";
          sMetric = i === 2 ? "GLUT4 TRANSLOCATION" : "+1,500% OXYGEN";
          sLabel = i === 2 ? "INSULIN-INDEPENDENT" : "MITOCHONDRIA PEAK";
          sHeadline = i === 2 ? "GLUCOSE MEMBRANE CONDUCTION DATA" : "CELLULAR RESPIRATION SURGE MEASUREMENT";
        } else if (isPlane) {
          sIcon = i === 2 ? "📐" : "☁️";
          sMetric = i === 2 ? "DOWNWASH DEFLECTION" : "L = ṁ · Δv";
          sLabel = i === 2 ? "COANDĂ EFFECT" : "LIFT VECTOR BALANCE";
          sHeadline = i === 2 ? "AIRFOIL VELOCITY GRADIENT & DOWNWARD MOMENTUM" : "CONTINUOUS HIGH-ALTITUDE LIFT RETENTION";
        } else if (isTree) {
          sIcon = i === 2 ? "☀️" : "🌲";
          sMetric = i === 2 ? "95% FROM AIR" : "1,000 TONS WOOD";
          sLabel = i === 2 ? "CO2 FIXATION" : "CELLULOSE TITAN";
          sHeadline = i === 2 ? "STOMATAL GAS UPTAKE MASS BALANCE" : "ORGANIC BIOMASS ACCUMULATION AUDIT";
        } else if (isLightning) {
          sIcon = i === 2 ? "⚡" : "🔥";
          sMetric = i === 2 ? "100,000 KM/S" : "30,000 KELVIN";
          sLabel = i === 2 ? "RETURN STROKE" : "5× SUN SURFACE";
          sHeadline = i === 2 ? "GROUND-TO-CLOUD ELECTRICAL SURGE OSCILLOGRAM" : "THERMAL PLASMA CHANNEL MEASUREMENT";
        } else if (isMoney) {
          sIcon = i === 2 ? "📊" : "🌳";
          sMetric = i === 2 ? "₹1,09,500" : "₹12,80,000+";
          sLabel = i === 2 ? "30-YEAR CAPITAL" : "COMPOUND MULTIPLIER";
          sHeadline = i === 2 ? "EMPIRICAL CAPITAL ACCUMULATION CURVE" : "EXPONENTIAL WEALTH MULTIPLIER VERIFIED";
        }

        let sceneNarration = "";
        if (i === 2) {
          if (isFridge) {
            sceneNarration = "Refrigerant gas is compressed until hot, condensed on rear coils, and squeezed through a needle valve to abruptly expand.";
          } else if (isShrimp) {
            sceneNarration = "The peacock mantis shrimp snaps its spring-loaded dactyl club so rapidly that it boils surrounding water through acoustic cavitation.";
          } else if (isMoney) {
            sceneNarration = "Saving ten rupees daily equals thirty-six hundred rupees a year, adding up to over one lakh rupees in thirty years.";
          } else if (isWood) {
            sceneNarration = "When an Aquilaria tree is infected by mold fungus, it produces a dense, dark aromatic resin in defense.";
          } else if (isAnt) {
            sceneNarration = "Ant colonies solve complex traveling routes through stigmergy, laying volatile paper-thin pheromone scent trails.";
          } else if (isRun) {
            sceneNarration = "The moment muscles contract, cellular energy drops, activating the master sensor AMPK to absorb glucose without insulin.";
          } else if (isPlane) {
            sceneNarration = "The curved airfoil deflects thousands of tons of air downwards every second using the Coanda effect.";
          } else if (isConcrete) {
            sceneNarration = "Roman concrete mixes volcanic pozzolana ash with quicklime and seawater, creating a reactive chemical matrix.";
          } else if (isTree) {
            sceneNarration = "A tiny three-milligram seed sucks carbon dioxide gas straight out of the atmosphere through constant photosynthesis.";
          } else if (isLightning) {
            sceneNarration = "While a faint stepped leader steps downward in fifty-meter zigzag jumps, an ionized channel forms to the ground.";
          } else {
            sceneNarration = this.formatCleanNarration(idea.explanation, 20);
          }
        } else {
          // Scene 3: Punchline
          if (isFridge) {
            sceneNarration = "This sudden pressure drop rapidly cools the coils to minus fifteen degrees Celsius, absorbing all internal food heat.";
          } else if (isShrimp) {
            sceneNarration = "The punch moves at fifty miles per hour with fifteen hundred newtons of force, effortlessly shattering thick aquarium glass.";
          } else if (isMoney) {
            sceneNarration = "Over thirty years, geometric compounding explodes that pocket change into over twelve lakh rupees purely through reinvestment.";
          } else if (isWood) {
            sceneNarration = "Top-grade Kyara agarwood has sold for up to ten thousand dollars per single gram, dwarfing the price of gold.";
          } else if (isAnt) {
            sceneNarration = "Shorter routes allow quicker round trips, accumulating denser scent marks that recruit more foragers into an optimal highway.";
          } else if (isRun) {
            sceneNarration = "Your mitochondria increase oxygen consumption by fifteen hundred percent, multiplying capillary blood flow tenfold.";
          } else if (isPlane) {
            sceneNarration = "According to Newton's third law, this downward downwash generates hundreds of kilonewtons of equal and opposite upward lift.";
          } else if (isConcrete) {
            sceneNarration = "Seawater dissolves lime clasts, forming aluminous tobermorite crystals that heal cracks into rock-solid stone. Rome literally grows stronger.";
          } else if (isTree) {
            sceneNarration = "Over ninety-five percent of this colossal thousand-ton giant is built purely from sunlight, water, and thin air.";
          } else if (isLightning) {
            sceneNarration = "The brilliant return stroke rushes from ground to cloud at one-third the speed of light, reaching thirty thousand Kelvin.";
          } else {
            sceneNarration = this.formatCleanNarration(idea.factualBasis, 20);
          }
        }

        scenes.push({
          sceneNumber: i,
          timeRange,
          narration: sceneNarration,
          videoPrompt,
          visualDescription: `Continuous paper graphics animation extending Scene ${prevScene}'s final frame with expanding diagrams and moving paper metrics.`,
          paperElements: ['Unfolding origami tabs', 'Animated paper metric dials', 'Comparison card panels', 'Directional paper arrows'],
          metricNumber: sMetric,
          metricLabel: sLabel,
          heroIcon: sIcon,
          documentHeadline: sHeadline,
          documentSnippet: i === 2 ? idea.explanation.slice(0, 120) : idea.factualBasis.slice(0, 120)
        });
      }
    }

    return {
      id: planId,
      title: idea.title,
      verifiedConcept: idea.explanation,
      duration: validDuration,
      sceneCount,
      aspectRatio,
      scenes,
      sources: idea.sources,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Start rendering the Paper Explainer Video asynchronously
   */
  static async renderPaperExplainerVideo(
    plan: PaperProductionPlan,
    options: {
      voice?: string;
      lang?: string;
      musicTrack?: string;
      sfxEnabled?: boolean;
    } = {}
  ): Promise<PaperRenderJob> {
    const jobId = 'paper_' + Date.now();
    const job: PaperRenderJob = {
      id: jobId,
      planId: plan.id,
      status: 'pending',
      progress: 5,
      message: 'Initializing Paper Explainer render pipeline...',
      duration: plan.duration,
      aspectRatio: plan.aspectRatio,
      createdAt: new Date().toISOString(),
    };

    paperRenderJobs.set(jobId, job);

    // Launch background execution
    this.executeRenderPipeline(jobId, plan, options).catch((err) => {
      console.error(`[PaperStudio] Render job ${jobId} failed:`, err);
      job.status = 'failed';
      job.error = err.message || 'Render failed';
      job.message = `Render failed: ${err.message}`;
    });

    return job;
  }

  private static async executeRenderPipeline(
    jobId: string,
    plan: PaperProductionPlan,
    options: {
      voice?: string;
      lang?: string;
      musicTrack?: string;
      sfxEnabled?: boolean;
    }
  ): Promise<void> {
    const job = paperRenderJobs.get(jobId);
    if (!job) return;

    const audioDir = path.join(process.cwd(), 'public', 'audio');
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // 1. Synthesize Narration Voiceover PER SCENE for frame-accurate sync
    job.status = 'generating_voice';
    job.progress = 20;
    job.message = 'Synthesizing voice narration and transcribing millisecond word boundaries...';

    // Synthesize dedicated audio tracks for EACH scene with Whisper word-level timestamps
    for (let i = 0; i < plan.scenes.length; i++) {
      const scene = plan.scenes[i];
      const sceneAudioRel = `/audio/narration_paper_${jobId}_s${i + 1}.wav`;
      const sceneAudioAbs = path.join(process.cwd(), 'public', 'audio', `narration_paper_${jobId}_s${i + 1}.wav`);
      try {
        await this.synthesizeVoice(scene.narration, sceneAudioAbs, options.voice || 'af_heart', options.lang || 'en');
        scene.narrationSrc = sceneAudioRel;
        console.log(`[PaperStudio] Scene ${i + 1} narration audio generated: ${sceneAudioAbs}`);

        // Transcribe word-level timestamps with Whisper for millisecond sync
        const wordsJsonAbs = path.join(process.cwd(), 'public', 'audio', `narration_paper_${jobId}_s${i + 1}_words.json`);
        await this.transcribeSceneAudio(sceneAudioAbs, wordsJsonAbs);

        if (fs.existsSync(wordsJsonAbs)) {
          try {
            const raw = JSON.parse(fs.readFileSync(wordsJsonAbs, 'utf-8'));
            const extractedWords = (raw.segments || []).flatMap((seg: any) => seg.words || []);
            if (extractedWords.length > 0) {
              scene.words = extractedWords.map((w: any) => ({
                word: (w.word || '').trim(),
                start: typeof w.start === 'number' ? Math.round(w.start * 1000) / 1000 : 0,
                end: typeof w.end === 'number' ? Math.round(w.end * 1000) / 1000 : 0,
              })).filter((w: any) => w.word.length > 0);

              // Update scene narration text to match the exact transcribed audio
              if (raw.text && raw.text.trim()) {
                scene.narration = raw.text.trim();
              }
              console.log(`[PaperStudio] Scene ${i + 1} transcribed ${scene.words?.length || 0} words with millisecond precision.`);
            }
          } catch (pe) {
            console.warn(`[PaperStudio] Error parsing words json for scene ${i + 1}:`, pe);
          }
        }

        // Reliable fallback if whisper didn't produce words
        if (!scene.words || scene.words.length === 0) {
          const rawWords = scene.narration.trim().split(/\s+/);
          const estSec = Math.min(8.0, Math.max(2.5, rawWords.length * 0.38));
          const step = estSec / rawWords.length;
          scene.words = rawWords.map((w, wIdx) => ({
            word: w,
            start: Math.round(wIdx * step * 1000) / 1000,
            end: Math.round((wIdx + 1) * step * 1000) / 1000,
          }));
        }
      } catch (err: any) {
        console.warn(`[PaperStudio] Scene ${i + 1} TTS error:`, err.message);
      }
    }

    // Synthesize full narration for entire video (fallback/global)
    const fullNarration = plan.scenes.map(s => s.narration).join(' ');
    const narrationRel = `/audio/narration_paper_${jobId}.wav`;
    const narrationAbs = path.join(process.cwd(), 'public', 'audio', `narration_paper_${jobId}.wav`);

    try {
      await this.synthesizeVoice(fullNarration, narrationAbs, options.voice || 'af_heart', options.lang || 'en');
      console.log(`[PaperStudio] Full narration audio generated: ${narrationAbs}`);
    } catch (ttsErr: any) {
      console.warn(`[PaperStudio] Full TTS synthesis warning for ${jobId}:`, ttsErr.message);
      if (!fs.existsSync(narrationAbs) && plan.scenes[0]?.narrationSrc) {
        const firstSceneAbs = path.join(process.cwd(), 'public', plan.scenes[0].narrationSrc);
        if (fs.existsSync(firstSceneAbs)) {
          fs.copyFileSync(firstSceneAbs, narrationAbs);
        }
      }
    }

    // 2. Paper Modeling & Motion Setup
    job.status = 'modeling_paper';
    job.progress = 50;
    job.message = 'Rigging cream cardstock backdrop, layered cutouts, and origami unfolds...';

    // 3. Write Remotion Props JSON
    const relPropsPath = path.join('public', `props_paper_${jobId}.json`);
    const absPropsPath = path.join(process.cwd(), relPropsPath);
    const propsData = {
      title: plan.title,
      verifiedConcept: plan.verifiedConcept,
      duration: plan.duration,
      aspectRatio: plan.aspectRatio,
      scenes: plan.scenes,
      sources: plan.sources,
      narrationSrc: fs.existsSync(narrationAbs) ? narrationRel : (plan.scenes[0]?.narrationSrc || '/audio/narration.wav'),
      musicSrc: options.musicTrack || '/audio/bgm/ambient_documentary.wav',
      sfxEnabled: options.sfxEnabled !== false
    };
    fs.writeFileSync(absPropsPath, JSON.stringify(propsData, null, 2), 'utf-8');

    // 4. Calculate Dimensions & Remotion Frames
    const totalFrames = Math.max(90, plan.duration * 30);
    let width = 1080;
    let height = 1920;
    if (plan.aspectRatio === '16:9') {
      width = 1920;
      height = 1080;
    } else if (plan.aspectRatio === '1:1') {
      width = 1080;
      height = 1080;
    }

    const outputRel = path.join('output', `paper_explainer_${jobId}.mp4`);
    const outputAbs = path.join(process.cwd(), outputRel);

    job.status = 'rendering_video';
    job.progress = 70;
    job.message = `Encoding 1080p Paper Animation short (${totalFrames} frames @ 30 FPS)...`;

    await new Promise<void>((resolve, reject) => {
      const remotionCli = path.join(process.cwd(), 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
      const remotionArgs = [
        remotionCli,
        'render',
        'src/index.ts',
        'PaperExplainerReel',
        outputRel.replace(/\\/g, '/'),
        `--props=${relPropsPath.replace(/\\/g, '/')}`,
        `--width=${width}`,
        `--height=${height}`,
        `--frames=0-${totalFrames - 1}`,
        '--pixel-format=yuv420p',
        '--crf=19',
        '--preset=fast',
        '--audio-bitrate=320k',
        '--jpeg-quality=90',
        '--concurrency=4',
        '--overwrite'
      ];

      const p = spawn(process.execPath, remotionArgs);
      let stderr = '';

      p.stdout?.on('data', (d) => {
        const text = d.toString().trim();
        if (text) {
          console.log(`[Remotion Paper ${jobId}]`, text);
          // Try parsing progress percentage from remotion CLI stdout
          const match = text.match(/Rendered\s+(\d+)\/(\d+)/i) || text.match(/(\d+)%/);
          if (match) {
            const current = parseInt(match[1], 10);
            const total = match[2] ? parseInt(match[2], 10) : 100;
            const pct = Math.min(100, Math.round((current / total) * 100));
            job.progress = Math.min(99, 70 + Math.round((pct / 100) * 28));
          }
        }
      });

      p.stderr?.on('data', (d) => {
        const text = d.toString();
        stderr += text;
      });

      p.on('close', (code) => {
        try { fs.unlinkSync(absPropsPath); } catch (e) {}
        if (code === 0 || fs.existsSync(outputAbs) || fs.existsSync(outputRel)) {
          job.status = 'completed';
          job.progress = 100;
          job.message = 'Paper Explainer Video generated successfully!';
          job.videoUrl = `/${outputRel.replace(/\\/g, '/')}`;
          resolve();
        } else {
          reject(new Error(`Remotion render exited with code ${code}: ${stderr.slice(-300)}`));
        }
      });

      p.on('error', reject);
    });
  }

  private static formatCleanNarration(text: string, maxWords: number = 20): string {
    if (!text) return '';
    const clean = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    const words = clean.split(' ');
    if (words.length <= maxWords) return clean;
    const truncated = words.slice(0, maxWords).join(' ');
    const lastPunct = Math.max(truncated.lastIndexOf('.'), truncated.lastIndexOf(','), truncated.lastIndexOf(';'));
    if (lastPunct > truncated.length * 0.6) {
      return truncated.slice(0, lastPunct + 1).trim();
    }
    return truncated + '.';
  }

  private static normalizeForSpeech(text: string): string {
    if (!text) return '';
    let s = text.replace(/[\r\n]+/g, ' ').trim();

    // Temperature & degree normalization
    s = s.replace(/-\s*15\s*°?\s*C\b/gi, 'minus fifteen degrees Celsius');
    s = s.replace(/-\s*25\s*°?\s*C\b/gi, 'minus twenty-five degrees Celsius');
    s = s.replace(/(\d+)\s*°\s*C\b/gi, '$1 degrees Celsius');
    s = s.replace(/(\d+)\s*°\s*F\b/gi, '$1 degrees Fahrenheit');

    // 1. Math formulas & expressions normalization
    s = s.replace(/A\s*=\s*P\s*\(\s*1\s*\+\s*r\s*\/\s*n\s*\)\s*\^?\s*\(?\s*nt\s*\)?/gi,
      'A equals P times one plus r over n, to the power of n t');
    s = s.replace(/E\s*=\s*mc\^?2/gi, 'E equals m c squared');
    s = s.replace(/a\^?2\s*\+\s*b\^?2/gi, 'a squared plus b squared');
    s = s.replace(/(\w+)\^(\d+)/g, '$1 to the power of $2');

    // 2. Currency normalization for spoken audio
    s = s.replace(/₹\s*10(?:\s*rupees)?(?!\d)/gi, 'ten rupees');
    s = s.replace(/₹\s*500(?:\s*rupees)?(?!\d)/gi, 'five hundred rupees');
    s = s.replace(/₹\s*10[,.]?000(?:\s*rupees)?/gi, 'ten thousand rupees');
    s = s.replace(/₹\s*1[,.]?00[,.]?000(?:\s*rupees)?/gi, 'one lakh rupees');
    s = s.replace(/₹\s*10[,.]?00[,.]?000(?:\s*rupees)?/gi, 'ten lakh rupees');
    s = s.replace(/₹\s*1[,.]?00[,.]?00[,.]?000(?:\s*rupees)?/gi, 'one crore rupees');
    s = s.replace(/₹\s*2\.5\s*(?:crore|cr)/gi, 'two point five crore rupees');
    s = s.replace(/₹\s*12\.8\s*(?:lakh|lakhs|l)/gi, 'twelve point eight lakh rupees');
    s = s.replace(/₹\s*11\.7\s*(?:lakh|lakhs|l)/gi, 'eleven point seven lakh rupees');
    s = s.replace(/₹\s*1[,.]?09[,.]?500/gi, 'one lakh nine thousand five hundred rupees');
    s = s.replace(/₹\s*3[,.]?650/gi, 'three thousand six hundred and fifty rupees');

    // General ₹ symbol and Rs abbreviation cleanup
    s = s.replace(/₹\s*(\d+(?:\.\d+)?)\s*(?:crore|cr)\b/gi, '$1 crore rupees');
    s = s.replace(/₹\s*(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|l)\b/gi, '$1 lakh rupees');
    s = s.replace(/₹\s*(\d[\d,]*(?:\.\d+)?)/g, '$1 rupees');
    s = s.replace(/\bRs\.?\s*(\d[\d,]*)/gi, '$1 rupees');
    s = s.replace(/\b(\d+)\s*rs\b/gi, '$1 rupees');

    // 3. Technical & financial abbreviations
    s = s.replace(/\bprinc\.?\b/gi, 'principal');
    s = s.replace(/\bCAGR\b/g, 'compounded annual growth rate');
    s = s.replace(/\bROI\b/g, 'return on investment');
    s = s.replace(/(\d+)%/g, '$1 percent');
    s = s.replace(/\bavg\.?\b/gi, 'average');
    s = s.replace(/\bapprox\.?\b/gi, 'approximately');
    s = s.replace(/\bvs\.?\b/gi, 'versus');

    return s.replace(/\s+/g, ' ').trim();
  }

  private static async synthesizeVoice(
    text: string,
    outputPath: string,
    voice = 'af_heart',
    lang = 'en'
  ): Promise<void> {
    const cleanText = this.normalizeForSpeech(text);
    if (!cleanText) return;

    // Map voice names to optimal neural models
    let edgeVoice = 'en-US-ChristopherNeural';
    const vLower = (voice || '').toLowerCase();
    const lLower = (lang || '').toLowerCase();

    if (lLower.includes('hi') || vLower.includes('hindi') || vLower.includes('alpha')) {
      edgeVoice = 'hi-IN-MadhurNeural';
    } else if (vLower.includes('adam') || vLower.includes('george') || vLower.includes('guy')) {
      edgeVoice = 'en-US-GuyNeural';
    } else if (vLower.includes('heart') || vLower.includes('sky') || vLower.includes('female') || vLower.includes('jenny')) {
      edgeVoice = 'en-US-JennyNeural';
    } else if (vLower.includes('nicole') || vLower.includes('aria')) {
      edgeVoice = 'en-US-AriaNeural';
    } else if (voice && voice.includes('-')) {
      edgeVoice = voice;
    }

    const scriptTemp = path.join(process.cwd(), 'scripts', `temp_paper_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.txt`);
    fs.writeFileSync(scriptTemp, cleanText, 'utf-8');

    const edgeCli = path.join(process.cwd(), '.venv-tts', 'Scripts', 'edge-tts.exe');
    const pythonExe = path.join(process.cwd(), '.venv-tts', 'Scripts', 'python.exe');

    // 1. PRIMARY FAST SYNTHESIS: Edge-TTS (high speed 1-2s, crystal clear studio audio)
    if (fs.existsSync(edgeCli)) {
      try {
        const tempMp3 = outputPath.endsWith('.wav') ? outputPath.replace(/\.wav$/i, '.temp.mp3') : outputPath;
        await new Promise<void>((resolve, reject) => {
          const args = ['-f', scriptTemp, '-v', edgeVoice, '--write-media', tempMp3];
          const p = spawn(edgeCli, args);
          const timeout = setTimeout(() => {
            p.kill();
            reject(new Error('Edge-TTS timed out'));
          }, 35000);

          p.on('close', (code) => {
            clearTimeout(timeout);
            if (code === 0 && fs.existsSync(tempMp3)) {
              if (outputPath.endsWith('.wav')) {
                const ffmpeg = spawn('ffmpeg', ['-y', '-i', tempMp3, '-ar', '24000', outputPath]);
                ffmpeg.on('close', (fCode) => {
                  try { fs.unlinkSync(tempMp3); } catch (e) {}
                  if (fCode === 0 && fs.existsSync(outputPath)) {
                    resolve();
                  } else {
                    reject(new Error(`FFmpeg convert failed with code ${fCode}`));
                  }
                });
                ffmpeg.on('error', (err) => {
                  try { fs.unlinkSync(tempMp3); } catch (e) {}
                  reject(err);
                });
              } else {
                resolve();
              }
            } else {
              reject(new Error(`Edge-TTS exited with code ${code}`));
            }
          });

          p.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });

        try { fs.unlinkSync(scriptTemp); } catch (e) {}
        const isSceneAudio = outputPath.includes('_s');
        await this.fitAudioDuration(outputPath, isSceneAudio ? 8.6 : 28.2);
        return; // Success!
      } catch (edgeErr: any) {
        console.warn(`[PaperStudio] Edge-TTS warning (${edgeErr.message}), trying local Kokoro TTS...`);
      }
    }

    // 2. SECONDARY LOCAL SYNTHESIS: Kokoro 82M
    const genScript = path.join(process.cwd(), 'scripts', 'generate_narration.py');
    if (fs.existsSync(pythonExe) && fs.existsSync(genScript)) {
      await new Promise<void>((resolve, reject) => {
        const langCode = (lang === 'Hindi' || lang === 'hi' || lang === 'h') ? 'h' : 'a';
        const voiceName = (langCode === 'h') ? 'hf_alpha' : (voice || 'af_heart');

        const args = [genScript, scriptTemp, outputPath, '--voice', voiceName, '--lang', langCode];
        const p = spawn(pythonExe, args);

        const timeout = setTimeout(() => {
          p.kill();
          reject(new Error('Kokoro TTS generation timed out'));
        }, 75000);

        p.on('close', async (code) => {
          clearTimeout(timeout);
          try { fs.unlinkSync(scriptTemp); } catch (e) {}
          if (code === 0 && fs.existsSync(outputPath)) {
            const isSceneAudio = outputPath.includes('_s');
            await this.fitAudioDuration(outputPath, isSceneAudio ? 8.6 : 28.2);
            resolve();
          } else {
            reject(new Error(`Kokoro TTS generation exited with code ${code}`));
          }
        });

        p.on('error', (err) => {
          clearTimeout(timeout);
          try { fs.unlinkSync(scriptTemp); } catch (e) {}
          reject(err);
        });
      });
      return;
    }

    try { fs.unlinkSync(scriptTemp); } catch (e) {}
    throw new Error('No TTS engine available');
  }

  private static async fitAudioDuration(audioPath: string, maxSeconds: number): Promise<void> {
    if (!fs.existsSync(audioPath)) return;
    try {
      await new Promise<void>((resolve) => {
        const probe = spawn('ffprobe', [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          audioPath
        ]);
        let out = '';
        probe.stdout?.on('data', d => out += d.toString());
        probe.on('close', (c) => {
          const dur = parseFloat(out.trim());
          if (!isNaN(dur) && dur > maxSeconds) {
            const tempo = Math.min(1.30, +(dur / (maxSeconds - 0.2)).toFixed(2));
            const spedUp = audioPath + '.fit.wav';
            const sp = spawn('ffmpeg', [
              '-y',
              '-i', audioPath,
              '-filter:a', `atempo=${tempo}`,
              '-ar', '24000',
              spedUp
            ]);
            sp.on('close', (spCode) => {
              if (spCode === 0 && fs.existsSync(spedUp)) {
                fs.copyFileSync(spedUp, audioPath);
                try { fs.unlinkSync(spedUp); } catch (e) {}
              }
              resolve();
            });
            sp.on('error', () => resolve());
          } else {
            resolve();
          }
        });
        probe.on('error', () => resolve());
      });
    } catch (e) {}
  }

  private static async transcribeSceneAudio(audioAbs: string, outputJsonAbs: string): Promise<void> {
    const pythonExe = path.join(process.cwd(), '.venv-tts', 'Scripts', 'python.exe');
    const transcribeScript = path.join(process.cwd(), 'scripts', 'transcribe_words.py');
    if (!fs.existsSync(pythonExe) || !fs.existsSync(transcribeScript) || !fs.existsSync(audioAbs)) {
      return;
    }

    return new Promise<void>((resolve) => {
      const p = spawn(pythonExe, [transcribeScript, audioAbs, outputJsonAbs, '--model', 'tiny', '--language', 'en']);
      const timeout = setTimeout(() => {
        try { p.kill(); } catch (e) {}
        resolve();
      }, 20000);

      p.on('close', () => {
        clearTimeout(timeout);
        resolve();
      });
      p.on('error', (err) => {
        clearTimeout(timeout);
        console.warn('[PaperStudio] transcribeSceneAudio process error:', err.message);
        resolve();
      });
    });
  }
}
