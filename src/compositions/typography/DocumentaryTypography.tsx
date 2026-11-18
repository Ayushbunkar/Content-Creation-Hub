import React, { FC, ReactNode } from 'react';
import { interpolate, Easing } from 'remotion';

// ==========================================
// TITLE SAFE AREA CONTAINER
// Guarantees 80px horizontal and 60px vertical safety margins
// ==========================================
export const TitleSafeArea: FC<{ children: ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: '60px 80px',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ==========================================
// 1. MODERN DOCUMENTARY SUBTITLES
// ==========================================
export const ModernDocumentarySubtitles: FC<{ text: string }> = ({ text }) => {
  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          maxWidth: '1280px',
          padding: '14px 28px',
          backgroundColor: 'rgba(5, 9, 20, 0.88)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(12px)',
          textAlign: 'center',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
        }}
      >
        <span
          style={{
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: '32px',
            fontWeight: 700,
            color: '#f8fafc',
            lineHeight: 1.4,
            letterSpacing: '-0.3px',
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};

// ==========================================
// 2. BOLD CENTERED SUBTITLES
// ==========================================
export const BoldCenteredSubtitles: FC<{ text: string }> = ({ text }) => {
  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <span
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '44px',
          fontWeight: 900,
          color: '#ffffff',
          textTransform: 'uppercase',
          letterSpacing: '-1px',
          lineHeight: 1.25,
          textShadow: '0 4px 16px rgba(0, 0, 0, 0.9), 0 2px 4px rgba(0,0,0,0.8)',
        }}
      >
        {text}
      </span>
    </div>
  );
};

// ==========================================
// 3. YELLOW HIGHLIGHTED SUBTITLES
// ==========================================
export const YellowHighlightedSubtitles: FC<{ text: string; highlightWord?: string }> = ({
  text,
  highlightWord,
}) => {
  const parts = highlightWord ? text.split(new RegExp(`(${highlightWord})`, 'gi')) : [text];

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          maxWidth: '1300px',
          padding: '14px 30px',
          backgroundColor: 'rgba(3, 7, 18, 0.92)',
          borderRadius: '10px',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          textAlign: 'center',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '34px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.4 }}>
          {parts.map((p, i) =>
            highlightWord && p.toLowerCase() === highlightWord.toLowerCase() ? (
              <span
                key={i}
                style={{
                  backgroundColor: '#eab308',
                  color: '#020617',
                  padding: '2px 10px',
                  borderRadius: '6px',
                  fontWeight: 900,
                  margin: '0 4px',
                  boxShadow: '0 0 16px rgba(234, 179, 8, 0.6)',
                }}
              >
                {p}
              </span>
            ) : (
              p
            )
          )}
        </span>
      </div>
    </div>
  );
};

// ==========================================
// 4. MINIMAL WHITE SUBTITLES (Broadcast Standard)
// ==========================================
export const MinimalWhiteSubtitles: FC<{ text: string }> = ({ text }) => {
  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <span
        style={{
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: '32px',
          fontWeight: 600,
          color: '#ffffff',
          lineHeight: 1.45,
          letterSpacing: '-0.2px',
          textShadow: '0 2px 8px rgba(0, 0, 0, 0.95), 0 0 20px rgba(0, 0, 0, 0.8)',
        }}
      >
        {text}
      </span>
    </div>
  );
};

// ==========================================
// 5. EDITORIAL NEWSPAPER HEADLINES
// ==========================================
export const EditorialNewspaperHeadline: FC<{
  publication: string;
  headline: string;
  date?: string;
}> = ({ publication, headline, date }) => {
  return (
    <div
      style={{
        width: '880px',
        backgroundColor: '#faf7f2',
        border: '1px solid #dcd7ce',
        padding: '30px 36px',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
        color: '#1c1917',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #1c1917', paddingBottom: '8px', marginBottom: '16px' }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 900, letterSpacing: '2px' }}>
          {publication.toUpperCase()}
        </span>
        {date && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#78716c', alignSelf: 'center' }}>
            {date}
          </span>
        )}
      </div>
      <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '38px', fontWeight: 900, lineHeight: 1.2, margin: 0 }}>
        {headline}
      </h3>
    </div>
  );
};

// ==========================================
// 6. BREAKING NEWS GRAPHICS (High-Impact Ticker)
// ==========================================
export const BreakingNewsGraphics: FC<{ headline: string; subtext?: string; frame: number }> = ({
  headline,
  subtext,
  frame,
}) => {
  const pulse = Math.sin((frame / 15) * Math.PI) * 0.15 + 0.85;

  return (
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Alert Header Badge */}
      <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#dc2626', padding: '6px 16px', borderRadius: '4px 4px 0 0', gap: '8px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ffffff', opacity: pulse }} />
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 900, color: '#ffffff', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
          BREAKING INVESTIGATION // CLASSIFIED
        </span>
      </div>

      {/* Main Ticker Card */}
      <div
        style={{
          backgroundColor: 'rgba(8, 14, 26, 0.94)',
          borderLeft: '5px solid #dc2626',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '18px 24px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 15px 35px rgba(0, 0, 0, 0.7)',
        }}
      >
        <h4 style={{ fontFamily: "'Inter', sans-serif", fontSize: '26px', fontWeight: 900, color: '#ffffff', margin: 0, textTransform: 'uppercase' }}>
          {headline}
        </h4>
        {subtext && (
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', color: '#cbd5e1', margin: '6px 0 0 0' }}>
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 7. LARGE CHAPTER TITLES
// ==========================================
export const LargeChapterTitles: FC<{
  chapterNumber: number | string;
  title: string;
  subtitle?: string;
  frame: number;
}> = ({ chapterNumber, title, subtitle, frame }) => {
  const lineW = interpolate(frame, [10, 50], [0, 360], { easing: Easing.out(Easing.cubic) });

  return (
    <div style={{ textAlign: 'center' }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 800, color: '#f59e0b', letterSpacing: '4px', textTransform: 'uppercase' }}>
        ACT {chapterNumber} // PRIMARY REPORT
      </span>
      <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: '56px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-1px', margin: '10px 0 0 0' }}>
        {title}
      </h2>
      <div style={{ width: `${lineW}px`, height: '2px', backgroundColor: '#38bdf8', margin: '18px auto', boxShadow: '0 0 10px #38bdf8' }} />
      {subtitle && (
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '17px', color: '#94a3b8', maxWidth: '720px', margin: '0 auto', lineHeight: 1.5 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

// ==========================================
// 8. ANIMATED STATISTICS CARD (Currency Preserved)
// ==========================================
export const AnimatedStatisticsCard: FC<{
  rawAmount: number;
  currencyType?: 'INR' | 'USD' | 'EUR' | 'PERCENT' | 'RAW';
  unit?: 'Cr' | 'Lakh' | 'Billion' | 'Trillion' | 'Million' | '%';
  label: string;
  subtext?: string;
  frame: number;
}> = ({ rawAmount, currencyType = 'USD', unit = 'Billion', label, subtext, frame }) => {
  const progress = interpolate(frame, [0, 50], [0, 1], { easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp' });
  const val = Math.round(rawAmount * progress);

  let prefix = '';
  if (currencyType === 'INR') prefix = '₹';
  else if (currencyType === 'USD') prefix = '$';
  else if (currencyType === 'EUR') prefix = '€';

  return (
    <div style={{ textAlign: 'center', padding: '0 40px' }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 800, color: '#38bdf8', letterSpacing: '2.5px', textTransform: 'uppercase' }}>
        VERIFIED FINANCIAL RECORD
      </span>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '84px', fontWeight: 900, letterSpacing: '-2px', color: '#ffffff', margin: '8px 0' }}>
        {prefix}{val.toLocaleString()} {unit}
      </div>
      <h4 style={{ fontFamily: "'Inter', sans-serif", fontSize: '20px', fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
        {label}
      </h4>
      {subtext && (
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '15px', color: '#94a3b8', maxWidth: '680px', margin: '10px auto 0 auto', lineHeight: 1.5 }}>
          {subtext}
        </p>
      )}
    </div>
  );
};

// ==========================================
// 9. LOWER THIRDS CARD
// ==========================================
export const LowerThirdsCard: FC<{
  name: string;
  designation: string;
  organization?: string;
  frame: number;
}> = ({ name, designation, organization, frame }) => {
  const slideX = interpolate(frame, [0, 20], [-80, 0], { easing: Easing.out(Easing.cubic) });
  const opacity = interpolate(frame, [0, 15], [0, 1]);

  return (
    <div style={{ transform: `translateX(${slideX}px)`, opacity }}>
      <div
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(5, 9, 20, 0.92)',
          borderLeft: '4px solid #38bdf8',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '14px 24px',
          borderRadius: '0 8px 8px 0',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
        }}
      >
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '22px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.5px' }}>
          {name.toUpperCase()}
        </span>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
          {designation}
        </span>
        {organization && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
            {organization}
          </span>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 10. LOCATION LABELS (Geopolitical Telemetry)
// ==========================================
export const LocationLabels: FC<{
  placeName: string;
  coordinates: string;
  theaterNote?: string;
}> = ({ placeName, coordinates, theaterNote }) => {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '14px', backgroundColor: 'rgba(5, 9, 20, 0.88)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '10px 18px', borderRadius: '6px', backdropFilter: 'blur(8px)' }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 10px #ef4444' }} />
      <div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 800, color: '#ffffff', letterSpacing: '1px' }}>
          {placeName.toUpperCase()}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#38bdf8' }}>
          {coordinates} {theaterNote ? `• ${theaterNote}` : ''}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 11. NAME AND DESIGNATION CARDS
// ==========================================
export const NameDesignationCard: FC<{
  name: string;
  title: string;
  organization: string;
  avatarUrl?: string;
  verified?: boolean;
}> = ({ name, title, organization, avatarUrl, verified = true }) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '18px',
        backgroundColor: 'rgba(8, 14, 26, 0.94)',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        padding: '16px 24px',
        borderRadius: '12px',
        boxShadow: '0 15px 40px rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {avatarUrl && (
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #38bdf8', flexShrink: 0 }}>
          <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '20px', fontWeight: 900, color: '#ffffff' }}>
            {name}
          </span>
          {verified && (
            <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              VERIFIED SUBJECT
            </span>
          )}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
          {title}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
          {organization}
        </div>
      </div>
    </div>
  );
};
