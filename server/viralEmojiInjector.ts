/**
 * Viral Emoji Injector
 * Dynamically associates and injects high-impact emojis (🔥, 💀, 🤯, 😂, 💰, ⚡, 🎯, 👑)
 * into transcript segments for short-form video retention.
 */

const EMOJI_KEYWORD_MAP: Array<{ regex: RegExp; emoji: string }> = [
  { regex: /\b(fire|lit|crazy|insane|op|unreal|epic|destroy|blast)\b/i, emoji: '🔥' },
  { regex: /\b(dead|died|rip|kill|bruh|lmao|nahh|roasted|no way)\b/i, emoji: '💀' },
  { regex: /\b(shocked|what|omg|wtf|impossible|wait|unbelievable|secrets?)\b/i, emoji: '🤯' },
  { regex: /\b(lol|haha|laugh|funny|comedy|rofl|joke|prank)\b/i, emoji: '😂' },
  { regex: /\b(money|rich|crore|lakh|million|dollar|profit|cash|wealth|billions?)\b/i, emoji: '💰' },
  { regex: /\b(fast|speed|lightning|quick|boost|rush|instant)\b/i, emoji: '⚡' },
  { regex: /\b(headshot|aim|target|clutch|bullseye|perfect|sniper)\b/i, emoji: '🎯' },
  { regex: /\b(king|boss|goat|winner|champion|victory|master)\b/i, emoji: '👑' },
  { regex: /\b(bhai|dost|bro|gang|squad|homie)\b/i, emoji: '🤝' },
  { regex: /\b(stop|danger|warning|careful|alert|trap)\b/i, emoji: '⚠️' },
  { regex: /\b(heart|love|proud|respect|salute)\b/i, emoji: '❤️' },
  { regex: /\b(mind|brain|thinking|idea|smart|genius)\b/i, emoji: '🧠' }
];

export function injectViralEmojisIntoText(text: string): string {
  if (!text) return '';
  let result = text;

  for (const { regex, emoji } of EMOJI_KEYWORD_MAP) {
    if (regex.test(result) && !result.includes(emoji)) {
      result = `${result} ${emoji}`;
      break; // Max 1 emoji per segment to maintain clean visual aesthetic
    }
  }

  return result.trim();
}

export function injectViralEmojisIntoSegments(segments: any[]): any[] {
  if (!Array.isArray(segments)) return [];
  return segments.map((seg, idx) => {
    // Only inject in every 2nd or 3rd segment or when high-impact keyword matches
    const textWithEmoji = injectViralEmojisIntoText(seg.text || '');
    return {
      ...seg,
      text: textWithEmoji
    };
  });
}
