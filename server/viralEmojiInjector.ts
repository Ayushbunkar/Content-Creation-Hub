/**
 * Viral Emoji Injector
 * Dynamically associates and injects high-impact emojis (🔥, 💀, 🤯, 😂, 💰, ⚡, 🎯, 👑)
 * into transcript segments for short-form video retention, tailored to gaming, stream chat,
 * Indian/Hinglish creators, reactions, and conversational punchlines.
 */

export interface EmojiRule {
  regex: RegExp;
  emoji: string;
}

export const EMOJI_KEYWORD_MAP: EmojiRule[] = [
  // 1. High-Impact Gaming, Clutch & Combat
  { regex: /\b(headshot|aim|target|clutch|bullseye|perfect|sniper|goli|nishana|frag|1v4|ace|carry)\b/i, emoji: '🎯' },
  { regex: /\b(king|boss|goat|winner|champion|victory|master|god\s*level|dominat(?:ing|ion)|legend)\b/i, emoji: '👑' },
  { regex: /\b(dead|died|rip|kill(?:ed)?|bruh|lmao|nahh|roasted|no\s*way|choke|knocked|eliminated|khatam|tata|bye\s*bye|mar\s*gaya)\b/i, emoji: '💀' },
  { regex: /\b(fire|lit|crazy|insane|op|unreal|epic|destroy|blast|wild|banger|tabahi|aag|machadi|phod\s*diya)\b/i, emoji: '🔥' },
  { regex: /\b(fast|speed|lightning|quick|boost|rush|instant|zoom|push|bhago|niklo|tez)\b/i, emoji: '⚡' },
  { regex: /\b(boom|bang|explosion|dhamaka|kaboom)\b/i, emoji: '💥' },

  // 2. Shock, Reactions & Disbelief
  { regex: /\b(shocked|what|omg|wtf|impossible|wait|unbelievable|secrets?|hacker|cheater|ye\s*kya|are\s*yaar)\b/i, emoji: '🤯' },
  { regex: /\b(look|watch|see|eyes?|notice|caught|4k|dekh|dekho|dhyan)\b/i, emoji: '👀' },
  { regex: /\b(freeze|cold|ice|chill|frozen|shivering|scared|darr|dar|kamp)\b/i, emoji: '🥶' },
  { regex: /\b(evil|devil|demon|villain|savage|gaddar|badla)\b/i, emoji: '😈' },
  { regex: /\b(secret|stealth|shh|silent|whisper|chup|sant)\b/i, emoji: '🤫' },

  // 3. Humor, Laughter & Trolls
  { regex: /\b(lol|haha|laugh(?:ing)?|funny|comedy|rofl|joke|prank|troll|noob|haso|maza|maja|pagal)\b/i, emoji: '😂' },

  // 4. Money, Business, Wealth & Success
  { regex: /\b(money|rich|crore|lakh|million|dollar|profit|cash|wealth|billions?|paisa|kamai|ameer|stonks|crypto)\b/i, emoji: '💰' },
  { regex: /\b(grow(?:th)?|scale|up|rising|skyrocket|rocket|chand)\b/i, emoji: '🚀' },

  // 5. Intelligence, Strategy & IQ
  { regex: /\b(mind|brain|thinking|idea|smart|genius|iq|200\s*iq|strategy|dimaag|soch)\b/i, emoji: '🧠' },
  { regex: /\b(plan|solution|trick|hack|idea)\b/i, emoji: '💡' },

  // 6. Community, Friendship & Emotion
  { regex: /\b(bhai|dost|bro|gang|squad|homie|partner|team|yaar|dosti)\b/i, emoji: '🤝' },
  { regex: /\b(heart|love|proud|respect|salute|dil|pyar|pyaar|wholesome)\b/i, emoji: '❤️' },
  { regex: /\b(party|celebrat(?:e|ion)|hype|dance|gg|ggwp|lets\s*go|congrats|nacho)\b/i, emoji: '🎉' },

  // 7. Danger & Alerts
  { regex: /\b(stop|danger|warning|careful|alert|trap|bachke|khatra|savdhan)\b/i, emoji: '⚠️' }
];

// Fallback high-retention viral emojis for punchlines (used on every 2nd or 3rd segment)
const RETENTION_EMOJIS = ['🔥', '💀', '🤯', '😂', '⚡', '👑', '🎯', '👀'];

/**
 * Clean transcript segment text (remove HTML entities and audio annotations)
 */
export function cleanTranscriptText(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&gt;/gi, '')
    .replace(/&lt;/gi, '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/^(\s*>+\s*)+/g, '')
    .replace(/(\s*>+\s*)+/g, ' ')
    .replace(/^(\s*<+\s*)+/g, '')
    .replace(/(\s*<+\s*)+/g, ' ')
    .replace(/\[[^\]]*(?:music|applause|laughter|cheering|sound|silence|audio|screaming)[^\]]*\]/gi, '')
    .replace(/\([^)]*(?:music|applause|laughter|cheering|sound|silence|audio|screaming)[^)]*\)/gi, '')
    .replace(/\[(?:music|applause|laughter|cheering|sound|silence|audio|screaming)[^\]]*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dynamically associates an emoji based on text context, sentiment, and punctuation
 */
export function getContextualEmoji(text: string, index: number = 0, chatContext?: string): string | null {
  const clean = cleanTranscriptText(text);
  if (!clean) return null;

  // 1. Keyword rule match
  for (const { regex, emoji } of EMOJI_KEYWORD_MAP) {
    if (regex.test(clean)) {
      return emoji;
    }
  }

  // 2. Chat / Action Trigger Context
  if (chatContext) {
    const ctx = chatContext.toUpperCase();
    if (ctx.includes('CLUTCH') || ctx.includes('OP')) return '🔥';
    if (ctx.includes('LOL') || ctx.includes('LMAO') || ctx.includes('FUNNY')) return '😂';
    if (ctx.includes('FAIL') || ctx.includes('DEAD')) return '💀';
    if (ctx.includes('WIN') || ctx.includes('W')) return '👑';
    if (ctx.includes('OMG') || ctx.includes('SHOCK')) return '🤯';
  }

  // 3. Punctuation & Speech Tone Heuristics
  if (clean.includes('?') || /\b(why|how|what|kya|kaise|kaha)\b/i.test(clean)) {
    return '❓';
  }
  if (clean.includes('!') || clean.toUpperCase() === clean && clean.length > 5) {
    return '💥';
  }

  // 4. Fallback Viral Retention Injection (every 2nd segment)
  if (index % 2 === 1) {
    return RETENTION_EMOJIS[(index >> 1) % RETENTION_EMOJIS.length];
  }

  return null;
}

/**
 * Injects a contextual emoji into a single text line
 */
export function injectViralEmojisIntoText(text: string, index: number = 0, chatContext?: string): string {
  if (!text) return '';
  const clean = cleanTranscriptText(text);
  if (!clean) return '';

  // Check if text already has an emoji
  const hasEmoji = /\p{Extended_Pictographic}/u.test(clean);
  if (hasEmoji) return clean;

  const emoji = getContextualEmoji(clean, index, chatContext);
  if (emoji && !clean.includes(emoji)) {
    return `${clean} ${emoji}`.trim();
  }

  return clean;
}

/**
 * Injects viral emojis across all transcript segments in a clip
 */
export function injectViralEmojisIntoSegments(segments: any[], context?: { hook?: string; title?: string; sentiment?: string; chatTrigger?: string }): any[] {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  const chatContext = [context?.chatTrigger, context?.sentiment, context?.hook].filter(Boolean).join(' ');

  let injectedCount = 0;
  const result = segments.map((seg, idx) => {
    const originalText = seg.text || '';
    const newText = injectViralEmojisIntoText(originalText, idx, chatContext);

    // If an emoji was appended, also keep words in sync if seg.words is present
    let words = seg.words;
    if (Array.isArray(words) && words.length > 0 && newText !== originalText) {
      const addedEmoji = newText.slice(originalText.length).trim();
      if (addedEmoji) {
        const lastWord = words[words.length - 1];
        words = [
          ...words.slice(0, -1),
          {
            ...lastWord,
            word: `${lastWord.word || ''} ${addedEmoji}`.trim()
          }
        ];
      }
    }

    if (newText !== originalText) injectedCount++;

    return {
      ...seg,
      text: newText,
      ...(words ? { words } : {})
    };
  });

  // Guarantee at least 1-2 punchy emojis in the clip if it was completely blank
  if (injectedCount === 0 && result.length > 0) {
    const firstEmoji = RETENTION_EMOJIS[0]; // 🔥
    result[0].text = `${cleanTranscriptText(result[0].text)} ${firstEmoji}`.trim();
  }

  return result;
}
