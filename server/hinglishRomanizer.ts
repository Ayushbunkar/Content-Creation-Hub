/**
 * Creator-Grade Roman Hinglish Transliteration Engine
 * Converts Devanagari Hindi and phonetic ASR transcripts into natural Roman Hinglish 
 * as used by top Indian creators (CarryMinati, Tanmay Bhat, BeastBoyShub, Mortal, Samay).
 */

export const ROMAN_RESPELL: Record<string, string> = {
  'nahin': 'nahi', 'nahi': 'nahi', 'vah': 'wo', 'vo': 'wo', 'yah': 'ye', 'ham': 'hum', 'kuchh': 'kuch',
  'achchha': 'accha', 'achchhi': 'acchi', 'achchhe': 'acche', 'mainne': 'maine', 'kyonki': 'kyunki',
  'kyon': 'kyun', 'pahle': 'pehle', 'pahla': 'pehla', 'pahli': 'pehli', 'zyaada': 'zyada',
  'vahaan': 'wahan', 'yahaan': 'yahan', 'jahaan': 'jahan', 'kahaan': 'kahan', 'hamen': 'humein',
  'hamaare': 'hamare', 'hamaara': 'hamara', 'hamaari': 'hamari', 'hamne': 'humne', 'hamko': 'humko',
  'tumhaara': 'tumhara', 'tumhaare': 'tumhare', 'tumhaari': 'tumhari', 'shaayad': 'shayad', 'thik': 'theek',
  'chiz': 'cheez', 'chizen': 'cheezein', 'chizon': 'cheezon', 'kaaphi': 'kaafi', 'chaahie': 'chahiye',
  'jaega': 'jayega', 'jaegi': 'jayegi', 'jaenge': 'jayenge', 'vagairah': 'wagairah', 'ismen': 'ismein',
  'usmen': 'usmein', 'jismen': 'jismein', 'inmen': 'inmein', 'unmen': 'unmein', 'vaala': 'wala',
  'vaali': 'wali', 'vaale': 'wale', 'vaise': 'waise', 'vaisa': 'waisa', 'vahi': 'wahi', 'vajah': 'wajah',
  'vaapas': 'wapas', 'baahar': 'bahar', 'daadi': 'dadi', 'unhonne': 'unhone', 'inhonne': 'inhone',
  'oopar': 'upar', 'dikhaaya': 'dikhaya', 'bataaya': 'bataya', 'gaanv': 'gaon', 'islie': 'isliye',
  'isilie': 'isliye', 'khaana': 'khana', 'khaane': 'khane', 'bachche': 'bacche', 'bachchon': 'bacchon',
  'dekhana': 'dekhna', 'aavaaz': 'awaaz', 'sirph': 'sirf', 'taraph': 'taraf', 'jivan': 'jeevan',
  'shuroo': 'shuru', 'chaahoonga': 'chahunga', 'chaahta': 'chahta', 'chaahti': 'chahti',
  'chaahte': 'chahte', 'pichhe': 'peeche', 'mahsoos': 'mehsoos', 'bachapan': 'bachpan',
  'dauraan': 'dauran', 'dhyaan': 'dhyan', 'baaten': 'baatein', 'pitaaji': 'pitaji', 'ajib': 'ajeeb',
  'kahaani': 'kahani', 'mitha': 'meetha', 'nae': 'naye', 'niklata': 'nikalta', 'khatm': 'khatam',
  'unhen': 'unhe', 'inhen': 'inhe', 'sochate': 'sochte', 'rakhata': 'rakhta', 'karib': 'kareeb',
  'donon': 'dono', 'dhire': 'dheere', 'karoonga': 'karunga', 'dekhie': 'dekhiye', 'karie': 'kariye',
  'lijie': 'lijiye', 'dijie': 'dijiye', 'boliye': 'boliye', 'gae': 'gaye', 'gai': 'gayi', 'aae': 'aaye',
  'aai': 'aayi', 'rupe': 'rupaye', 'jaata': 'jata', 'jaati': 'jati', 'jaate': 'jate', 'jaana': 'jana',
  'aata': 'aata', 'raavan': 'Ravan', 'raam': 'Ram', 'bhaarat': 'Bharat', 'hanumaan': 'Hanuman',
  'zindagi': 'zindagi', 'ekdam': 'ekdum', 'vagaira': 'wagaira', 'hamesha': 'hamesha', 'baare': 'baare',
  'saare': 'saare', 'saari': 'saari', 'poora': 'poora', 'poori': 'poori', 'kahte': 'kehte', 'kah': 'keh',
  'kahna': 'kehna', 'kaha': 'kaha', 'samajh': 'samajh', 'aaainge': 'aayenge', 'aaenge': 'aayenge',
  'sakoonga': 'sakunga', 'hoonga': 'hunga', 'loonga': 'lunga', 'doonga': 'dunga', 'boloon': 'bolun',
  'bhai': 'bhai', 'yaar': 'yaar', 'batao': 'batao', 'dekho': 'dekho', 'kya': 'kya', 'kaise': 'kaise',
  'kyun': 'kyun', 'chal': 'chal', 'ruko': 'ruko', 'suno': 'suno', 'are': 'arey', 'arey': 'arey'
};

// Common Devanagari to Roman Hinglish lookup dictionary
export const DEVANAGARI_COMMON: Record<string, string> = {
  'आज': 'aaj', 'हम': 'hum', 'की': 'ki', 'बात': 'baat', 'करेंगे': 'karenge',
  'क्या': 'kya', 'है': 'hai', 'हैं': 'hain', 'हो': 'ho', 'था': 'tha', 'थी': 'thi', 'थे': 'the',
  'नहीं': 'nahi', 'नही': 'nahi', 'ये': 'ye', 'यह': 'ye', 'वो': 'wo', 'वह': 'wo',
  'भाई': 'bhai', 'यार': 'yaar', 'अरे': 'arey', 'सुनो': 'suno', 'रुको': 'ruko',
  'देखो': 'dekho', 'बोलो': 'bolo', 'कहो': 'kaho', 'चलो': 'chalo', 'बहुत': 'bohot',
  'अच्छा': 'accha', 'अच्छी': 'acchi', 'अच्छे': 'acche', 'बुरा': 'bura',
  'कैसे': 'kaise', 'क्यों': 'kyun', 'कहाँ': 'kahan', 'यहाँ': 'yahan', 'वहाँ': 'wahan',
  'कब': 'kab', 'जब': 'jab', 'तब': 'tab', 'अब': 'ab', 'सब': 'sab',
  'अगर': 'agar', 'मगर': 'magar', 'लेकिन': 'lekin', 'क्योंकि': 'kyunki', 'इसलिए': 'isliye',
  'साहब': 'sahab', 'दोस्त': 'dost', 'लोग': 'log', 'काम': 'kaam', 'समय': 'samay',
  'खेल': 'khel', 'जीत': 'jeet', 'हार': 'haar', 'पैसा': 'paisa', 'पैसे': 'paise',
  'घर': 'ghar', 'गाड़ी': 'gaadi', 'दुनिया': 'duniya', 'जिंदगी': 'zindagi',
  'खत्म': 'khatam', 'शुरू': 'shuru', 'पहला': 'pehla', 'दूसरा': 'doosra', 'तीसरा': 'teesra',
  'एक': 'ek', 'दो': 'do', 'तीन': 'teen', 'चार': 'chaar', 'पांच': 'paanch',
  'सही': 'sahi', 'गलत': 'galat', 'सच': 'sach', 'झूठ': 'jhooth', 'प्यार': 'pyaar',
  'गुस्सा': 'gussa', 'मज़ा': 'maza', 'मजा': 'maza', 'ओपी': 'OP', 'क्लच': 'clutch',
  'हेडशॉट': 'headshot', 'मार': 'maar', 'बच': 'bach', 'भाग': 'bhaag', 'रुक': 'ruk'
};

// Devanagari character mapping fallback
const DEVA_VOWELS: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
  'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'an', 'अः': 'ah'
};

const DEVA_MATRAS: Record<string, string> = {
  'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
  'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ँ': 'n', '्': ''
};

const DEVA_CONSONANTS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'क्ष': 'ksh', 'त्र': 'tr', 'ज्ञ': 'gy'
};

export function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

export function transliterateDevanagariWord(word: string): string {
  // Strip nuktas and normalize
  const cleanWord = word.replace(/\u093C/g, '').trim();
  if (DEVANAGARI_COMMON[cleanWord]) return DEVANAGARI_COMMON[cleanWord];

  let result = '';
  const len = cleanWord.length;
  for (let i = 0; i < len; i++) {
    const ch = cleanWord[i];
    const nextCh = i + 1 < len ? cleanWord[i + 1] : '';

    if (DEVA_VOWELS[ch]) {
      result += DEVA_VOWELS[ch];
    } else if (DEVA_MATRAS[ch]) {
      result += DEVA_MATRAS[ch];
    } else if (DEVA_CONSONANTS[ch]) {
      const base = DEVA_CONSONANTS[ch];
      if (nextCh === '्') {
        result += base; // Halant, no inherent vowel
        i++; // skip halant
      } else if (DEVA_MATRAS[nextCh]) {
        result += base; // matra will provide vowel
      } else if (i === len - 1) {
        result += base; // word-final schwa deletion
      } else {
        result += base + 'a'; // inherent schwa
      }
    } else if (ch === '।') {
      result += '.';
    } else {
      result += ch;
    }
  }

  // Common cleanups
  return result
    .replace(/aa+/g, 'aa')
    .replace(/ee+/g, 'ee')
    .replace(/oo+/g, 'oo');
}

/**
 * Romanize an entire sentence or transcript segment
 */
export function romanizeText(text: string): string {
  if (!text) return '';

  // Replace Hindi full stop danda with standard period
  let normalized = text.replace(/।/g, '.').replace(/॥/g, '.');

  const tokens = normalized.split(/(\s+|[.,!?;:()"])/);
  const transformed = tokens.map((tok) => {
    if (!tok || /^\s+$/.test(tok) || /^[.,!?;:()"]+$/.test(tok)) return tok;

    const lower = tok.toLowerCase();
    // 1. Direct creator respelling map
    if (ROMAN_RESPELL[lower]) {
      const resp = ROMAN_RESPELL[lower];
      return tok[0] === tok[0].toUpperCase() ? resp.charAt(0).toUpperCase() + resp.slice(1) : resp;
    }

    // 2. Devanagari transliteration
    if (hasDevanagari(tok)) {
      const romanized = transliterateDevanagariWord(tok);
      return tok[0] === tok[0].toUpperCase() ? romanized.charAt(0).toUpperCase() + romanized.slice(1) : romanized;
    }

    return tok;
  });

  return transformed.join('');
}

/**
 * Romanize transcript segments while preserving timestamps
 */
export function romanizeSegments(segments: any[]): any[] {
  if (!Array.isArray(segments)) return [];
  return segments.map((seg) => {
    const romanText = romanizeText(seg.text || '');
    const romanWords = Array.isArray(seg.words)
      ? seg.words.map((w: any) => ({
          ...w,
          word: romanizeText(w.word || '')
        }))
      : [];
    return {
      ...seg,
      text: romanText,
      words: romanWords
    };
  });
}
