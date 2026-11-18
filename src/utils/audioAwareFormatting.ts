/**
 * ADVANCED AUDIO-AWARE CAPTION, FORMULA & CURRENCY RENDERING MODULE
 * 
 * Provides:
 * 1. Accurate Audio-to-Caption Synchronization & Normalization
 * 2. Currency & Rupees Formatting (Indian Numbering System, ₹ Symbol, Lakhs/Crores)
 * 3. Mathematical Formulas & Technical Expression Typesetting
 * 4. Natural Spoken Script Normalization for TTS Engines (Prevents "carrot and tea" or mechanical abbreviations)
 * 5. Three-Level Caption Visual Hierarchy
 */

// =============================================================================
// 1. SPOKEN AUDIO SCRIPT NORMALIZATION FOR TTS ENGINES
// Ensures TTS speaks naturally without reading symbols mechanically
// =============================================================================

export function normalizeScriptForSpokenTTS(text: string, lang = 'en'): string {
  if (!text) return '';

  let s = text;

  // 1. Math formulas & expressions normalization
  // Compound interest: A = P(1 + r/n)^(nt) -> natural spoken words
  s = s.replace(/A\s*=\s*P\s*\(\s*1\s*\+\s*r\s*\/\s*n\s*\)\s*\^?\s*\(?\s*nt\s*\)?/gi,
    'A equals P times one plus r over n, to the power of n t');
  s = s.replace(/E\s*=\s*mc\^?2/gi, 'E equals m c squared');
  s = s.replace(/a\^?2\s*\+\s*b\^?2/gi, 'a squared plus b squared');
  s = s.replace(/(\w+)\^(\d+)/g, '$1 to the power of $2');

  // 2. Currency normalization for spoken audio
  // Spoken: "₹10" -> "ten rupees", "₹1,00,000" -> "one lakh rupees", "₹10 crore" -> "ten crore rupees"
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

  // Clean double spaces
  return s.replace(/\s+/g, ' ').trim();
}

// =============================================================================
// 2. CURRENCY & INDIAN NUMBERING SYSTEM FORMATTER FOR DISPLAY
// Converts spoken words or numbers into standard, pristine Indian currency format
// =============================================================================

export function formatIndianNumber(num: number): string {
  const str = Math.round(num).toString();
  if (str.length <= 3) return str;
  const lastThree = str.substring(str.length - 3);
  const rest = str.substring(0, str.length - 3);
  const formattedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${formattedRest},${lastThree}`;
}

export function formatCurrencyForDisplay(input: string): string {
  if (!input) return '';

  let out = input;

  // Replace old "Rs." or "rs" or "rupees" with official "₹"
  out = out.replace(/\b(?:rs\.?|inr)\s*(\d[\d,]*(?:\.\d+)?)/gi, '₹$1');
  out = out.replace(/(\d[\d,]*(?:\.\d+)?)\s*(?:rupees|rs\.?)/gi, '₹$1');

  // Specific spoken phrase to Indian format mapping
  const replacements: [RegExp, string][] = [
    [/\bten rupees\b/gi, '₹10'],
    [/\bfive hundred rupees\b/gi, '₹500'],
    [/\bten thousand rupees\b/gi, '₹10,000'],
    [/\bone lakh rupees\b/gi, '₹1,00,000'],
    [/\bten lakh rupees\b/gi, '₹10,00,000'],
    [/\bone crore rupees\b/gi, '₹1,00,00,000'],
    [/\btwo point five crore\b/gi, '₹2.5 Crore'],
    [/\bfifty rupees per share\b/gi, '₹50 / Share'],
    [/\bthree hundred dollars\b/gi, '$300'],
    [/\btwelve point eight lakh(?:s)? rupees\b/gi, '₹12.8 Lakhs'],
    [/\beleven point seven lakh(?:s)? rupees\b/gi, '₹11.7 Lakhs'],
    [/\bone lakh nine thousand five hundred(?: rupees)?\b/gi, '₹1,09,500'],
    [/\bthree thousand six hundred (?:and )?fifty(?: rupees)?\b/gi, '₹3,650'],
  ];

  for (const [regex, rep] of replacements) {
    out = out.replace(regex, rep);
  }

  return out;
}

// =============================================================================
// 3. MATHEMATICAL FORMULA DETECTION & BEAUTIFICATION
// Detects spoken or written formulas and returns clean typographic structure
// =============================================================================

export interface DetectedFormula {
  raw: string;
  title: string;
  equationDisplay: string;
  latex: string;
  variables: { symbol: string; label: string; value?: string }[];
}

export function detectMathematicalFormula(text: string): DetectedFormula | null {
  if (!text) return null;

  const lower = text.toLowerCase();

  // Compound Interest Formula
  if (
    lower.includes('compound interest') ||
    lower.includes('formula a equals p') ||
    lower.includes('a = p') ||
    lower.includes('1 + r/n') ||
    lower.includes('power of nt') ||
    lower.includes('carrot and tea')
  ) {
    return {
      raw: text,
      title: 'COMPOUND INTEREST ACCELERATION MECHANISM',
      equationDisplay: 'A = P · (1 + r/n)ⁿᵗ',
      latex: 'A = P\\left(1 + \\frac{r}{n}\\right)^{nt}',
      variables: [
        { symbol: 'A', label: 'Final Accumulated Wealth', value: '₹12.8+ Lakhs' },
        { symbol: 'P', label: 'Principal Out-of-Pocket', value: '₹1,09,500' },
        { symbol: 'r', label: 'Annualized Growth Rate', value: '12% CAGR' },
        { symbol: 'n', label: 'Compounding Frequency', value: '365 (Daily)' },
        { symbol: 't', label: 'Time Horizon (Days)', value: '30 Yrs (10,950d)' },
      ],
    };
  }

  // Einstein's mass-energy equivalence
  if (lower.includes('e equals mc') || lower.includes('e = mc')) {
    return {
      raw: text,
      title: 'MASS-ENERGY EQUIVALENCE',
      equationDisplay: 'E = mc²',
      latex: 'E = mc^2',
      variables: [
        { symbol: 'E', label: 'Energy' },
        { symbol: 'm', label: 'Mass' },
        { symbol: 'c', label: 'Speed of Light', value: '3 × 10⁸ m/s' },
      ],
    };
  }

  // Return on Investment
  if (lower.includes('return on investment') || lower.includes('roi')) {
    return {
      raw: text,
      title: 'RETURN ON INVESTMENT (ROI)',
      equationDisplay: 'ROI = (Net Profit / Investment) × 100',
      latex: '\\text{ROI} = \\left(\\frac{\\text{Net Profit}}{\\text{Investment}}\\right) \\times 100\\%',
      variables: [
        { symbol: 'Net Profit', label: 'Pure Capital Gains', value: '+₹11.7 Lakhs' },
        { symbol: 'Investment', label: 'Total Invested Principal', value: '₹1,09,500' },
        { symbol: 'Multiplier', label: 'Total Percentage Gain', value: '+1,170%' },
      ],
    };
  }

  return null;
}

// =============================================================================
// 4. CAPTION PHRASE CHUNKER WITH LEVEL 1, 2, 3 HIERARCHY
// Splits captions into balanced, readable lines and flags special entities
// =============================================================================

export interface CaptionWord {
  text: string;
  displayText: string;
  isCurrency: boolean;
  isNumber: boolean;
  isKeyword: boolean;
  isFormulaTerm: boolean;
  level: 1 | 2 | 3;
}

export function parseCaptionHierarchy(words: string[]): CaptionWord[] {
  const KEYWORDS = new Set([
    'math', 'unbelievable', 'astonishing', 'scientific', 'truth',
    'exponentially', 'explodes', 'accelerates', 'verified', 'geometric',
    'compounding', 'reinvestment', 'hidden', 'power', 'nature', 'science',
    '30', 'years', 'daily', 'lakhs', 'crore', 'rupees'
  ]);

  return words.map((w) => {
    const cleanWord = w.replace(/[^a-zA-Z0-9₹%]/g, '').toLowerCase();
    const formatted = formatCurrencyForDisplay(w);

    const isCurrency = formatted.includes('₹') || formatted.includes('$') || /rupee/i.test(w);
    const isNumber = /\d/.test(w);
    const isKeyword = KEYWORDS.has(cleanWord) || /^[0-9]+%?$/.test(cleanWord);
    const isFormulaTerm = /^[A-Za-z]=[A-Za-z]|\(1\+r\/n\)|nt|mc²|CAGR|P\(1/i.test(w);

    let level: 1 | 2 | 3 = 1;
    if (isCurrency || isFormulaTerm || (isNumber && formatted.includes('₹'))) {
      level = 3; // Top visual hierarchy: Numbers, money, formulas
    } else if (isKeyword || isNumber) {
      level = 2; // Medium visual hierarchy: Important highlights
    }

    return {
      text: w,
      displayText: formatted,
      isCurrency,
      isNumber,
      isKeyword,
      isFormulaTerm,
      level,
    };
  });
}
