import React, { FC, useMemo, ReactNode } from 'react';
import { interpolate, Easing } from 'remotion';

// ==========================================
// 1. CINEMATIC SLOW ZOOM
// ==========================================
export interface SlowZoomProps {
  frame: number;
  durationFrames?: number;
  startScale?: number;
  endScale?: number;
  origin?: string;
  children: ReactNode;
}
export const CinematicSlowZoom: FC<SlowZoomProps> = ({
  frame,
  durationFrames = 120,
  startScale = 1.0,
  endScale = 1.08,
  origin = 'center center',
  children,
}) => {
  const scale = interpolate(frame, [0, durationFrames], [startScale, endScale], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ width: '100%', height: '100%', transform: `scale(${scale})`, transformOrigin: origin }}>
      {children}
    </div>
  );
};

// ==========================================
// 2. SMOOTH PUSH-IN
// ==========================================
export interface PushInProps {
  frame: number;
  durationFrames?: number;
  startScale?: number;
  endScale?: number;
  origin?: string;
  children: ReactNode;
}
export const SmoothPushIn: FC<PushInProps> = ({
  frame,
  durationFrames = 90,
  startScale = 1.0,
  endScale = 1.25,
  origin = '50% 45%',
  children,
}) => {
  const scale = interpolate(frame, [0, durationFrames], [startScale, endScale], {
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ width: '100%', height: '100%', transform: `scale(${scale})`, transformOrigin: origin }}>
      {children}
    </div>
  );
};

// ==========================================
// 3. SMOOTH PULL-OUT
// ==========================================
export interface PullOutProps {
  frame: number;
  durationFrames?: number;
  startScale?: number;
  endScale?: number;
  children: ReactNode;
}
export const SmoothPullOut: FC<PullOutProps> = ({
  frame,
  durationFrames = 100,
  startScale = 1.2,
  endScale = 1.0,
  children,
}) => {
  const scale = interpolate(frame, [0, durationFrames], [startScale, endScale], {
    easing: Easing.out(Easing.quad),
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ width: '100%', height: '100%', transform: `scale(${scale})`, transformOrigin: 'center center' }}>
      {children}
    </div>
  );
};

// ==========================================
// 4. PARALLAX IMAGE MOVEMENT (2.5D Multi-Plane)
// ==========================================
export interface ParallaxProps {
  frame: number;
  durationFrames?: number;
  bgMedia: string;
  fgMedia?: string;
  depthIntensity?: number;
}
export const ParallaxMotion: FC<ParallaxProps> = ({
  frame,
  durationFrames = 120,
  bgMedia,
  fgMedia,
  depthIntensity = 25,
}) => {
  const bgDrift = interpolate(frame, [0, durationFrames], [-depthIntensity * 0.5, depthIntensity * 0.5], {
    easing: Easing.linear,
  });
  const fgDrift = interpolate(frame, [0, durationFrames], [depthIntensity, -depthIntensity], {
    easing: Easing.linear,
  });
  const bgZoom = interpolate(frame, [0, durationFrames], [1.02, 1.1], { easing: Easing.linear });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: -40,
          backgroundImage: `url(${bgMedia})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform: `scale(${bgZoom}) translateX(${bgDrift}px)`,
          filter: 'brightness(0.7) contrast(1.15)',
        }}
      />
      {fgMedia && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `translateX(${fgDrift}px) scale(1.05)`,
            filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.8))',
          }}
        >
          <img src={fgMedia} alt="Foreground" style={{ maxHeight: '85%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
};

// ==========================================
// 5. PAPER-CUT COLLAGE
// ==========================================
export interface PaperCutProps {
  frame: number;
  imageUrl: string;
  headline: string;
  category?: string;
}
export const PaperCutCollage: FC<PaperCutProps> = ({ frame, imageUrl, headline, category = 'OFFICIAL EVIDENCE' }) => {
  const angle = interpolate(frame, [0, 60], [-2.5, -1.2], { easing: Easing.out(Easing.quad) });
  const scale = interpolate(frame, [0, 60], [0.94, 1.0], { easing: Easing.out(Easing.cubic) });

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#0c111c',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '780px',
          backgroundColor: '#f8fafc',
          padding: '24px 24px 36px 24px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65), 0 5px 15px rgba(0, 0, 0, 0.4)',
          transform: `scale(${scale}) rotate(${angle}deg)`,
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '8px', marginBottom: '14px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 800, color: '#dc2626', letterSpacing: '1.5px' }}>
            ● {category}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#64748b' }}>
            DEPT // INVESTIGATION
          </span>
        </div>
        <div style={{ height: '420px', overflow: 'hidden', marginBottom: '16px', backgroundColor: '#e2e8f0' }}>
          <img src={imageUrl} alt="Documentary cut" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'sepia(0.2) contrast(1.1)' }} />
        </div>
        <h4 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '24px', fontWeight: 900, color: '#0f172a', lineHeight: 1.25, margin: 0 }}>
          {headline}
        </h4>
      </div>
    </div>
  );
};

// ==========================================
// 6. NEWSPAPER HEADLINE ANIMATION
// ==========================================
export interface NewspaperAnimProps {
  frame: number;
  publication?: string;
  date?: string;
  headline: string;
  highlightPhrase?: string;
}
export const NewspaperHeadlineAnim: FC<NewspaperAnimProps> = ({
  frame,
  publication = 'THE FINANCIAL DISPATCH',
  date = 'NOVEMBER 2026',
  headline,
  highlightPhrase,
}) => {
  const zoom = interpolate(frame, [0, 90], [1.18, 1.0], { easing: Easing.out(Easing.cubic) });
  const markerW = interpolate(frame, [25, 60], [0, 100], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#090d16', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          width: '920px',
          backgroundColor: '#faf8f5',
          padding: '36px 40px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
          transform: `scale(${zoom})`,
          border: '1px solid #dcd7ce',
        }}
      >
        <div style={{ textAlign: 'center', borderBottom: '3px double #1c1917', paddingBottom: '12px', marginBottom: '18px' }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '38px', fontWeight: 900, letterSpacing: '4px', color: '#1c1917', margin: 0 }}>
            {publication.toUpperCase()}
          </h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#57534e', marginTop: '6px' }}>
            <span>VOL. CXXIV NO. 42</span>
            <span>{date.toUpperCase()}</span>
            <span>PRICE $2.50</span>
          </div>
        </div>

        <div style={{ position: 'relative', margin: '20px 0' }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '42px', fontWeight: 900, color: '#0c0a09', lineHeight: 1.15, margin: 0 }}>
            {headline}
          </h3>
          {highlightPhrase && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                bottom: '2px',
                width: `${markerW}%`,
                height: '18px',
                backgroundColor: 'rgba(250, 204, 21, 0.45)',
                mixBlendMode: 'multiply',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 7. KINETIC TYPOGRAPHY
// ==========================================
export interface KineticTypographyProps {
  frame: number;
  line1: string;
  line2: string;
  highlightWord?: string;
  accentColor?: string;
}
export const KineticTypography: FC<KineticTypographyProps> = ({
  frame,
  line1,
  line2,
  highlightWord,
  accentColor = '#f59e0b',
}) => {
  const line1Y = interpolate(frame, [0, 20], [60, 0], { easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp' });
  const line1Opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const line2Y = interpolate(frame, [10, 32], [60, 0], { easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp' });
  const line2Opacity = interpolate(frame, [10, 25], [0, 1], { extrapolateRight: 'clamp' });
  const gleamX = interpolate(frame, [25, 75], [-100, 200], { easing: Easing.linear });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 60px' }}>
      <div style={{ overflow: 'hidden' }}>
        <h1
          style={{
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: '76px',
            fontWeight: 900,
            color: '#f8fafc',
            letterSpacing: '-1.5px',
            margin: 0,
            transform: `translateY(${line1Y}px)`,
            opacity: line1Opacity,
            textTransform: 'uppercase',
          }}
        >
          {line1}
        </h1>
      </div>
      <div style={{ overflow: 'hidden', marginTop: '4px', position: 'relative' }}>
        <h2
          style={{
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: '84px',
            fontWeight: 900,
            letterSpacing: '-2px',
            margin: 0,
            transform: `translateY(${line2Y}px)`,
            opacity: line2Opacity,
            textTransform: 'uppercase',
            background: `linear-gradient(135deg, #ffffff 40%, ${accentColor} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: `drop-shadow(0 10px 30px ${accentColor}40)`,
          }}
        >
          {line2}
        </h2>
      </div>
    </div>
  );
};

// ==========================================
// 8. WORD-BY-WORD SUBTITLES
// ==========================================
export interface WordCue {
  text: string;
  startFrame: number;
  endFrame: number;
}
export interface WordByWordSubtitlesProps {
  frame: number;
  words: WordCue[];
  activeColor?: string;
  inactiveColor?: string;
}
export const WordByWordSubtitles: FC<WordByWordSubtitlesProps> = ({
  frame,
  words,
  activeColor = '#facc15',
  inactiveColor = '#94a3b8',
}) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '12px',
        maxWidth: '1200px',
        padding: '14px 28px',
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
      }}
    >
      {words.map((w, i) => {
        const isCurrent = frame >= w.startFrame && frame <= w.endFrame;
        const isPast = frame > w.endFrame;

        return (
          <span
            key={i}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '34px',
              fontWeight: 800,
              color: isCurrent ? activeColor : (isPast ? '#ffffff' : inactiveColor),
              textShadow: isCurrent ? `0 0 16px ${activeColor}` : undefined,
              transform: isCurrent ? 'scale(1.08)' : 'scale(1.0)',
              transition: 'transform 0.1s ease',
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

// ==========================================
// 9. YELLOW KEYWORD HIGHLIGHTING
// ==========================================
export interface YellowHighlightProps {
  text: string;
  highlightWord: string;
}
export const YellowKeywordHighlight: FC<YellowHighlightProps> = ({ text, highlightWord }) => {
  const parts = text.split(new RegExp(`(${highlightWord})`, 'gi'));
  return (
    <span style={{ color: '#f8fafc' }}>
      {parts.map((part, i) =>
        part.toLowerCase() === highlightWord.toLowerCase() ? (
          <span
            key={i}
            style={{
              backgroundColor: '#eab308',
              color: '#090d16',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 900,
              boxShadow: '0 0 14px rgba(234, 179, 8, 0.5)',
            }}
          >
            {part}
          </span>
        ) : (
          part
        )
      )}
    </span>
  );
};

// ==========================================
// 10. ANIMATED TIMELINE
// ==========================================
export interface TimelineEventItem {
  date: string;
  headline: string;
  description?: string;
}
export interface AnimatedTimelineProps {
  frame: number;
  events: TimelineEventItem[];
}
export const AnimatedTimeline: FC<AnimatedTimelineProps> = ({ frame, events }) => {
  const lineProgress = interpolate(frame, [0, 80], [0, 100], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ width: '1200px', margin: '0 auto', padding: '40px 0', position: 'relative' }}>
      {/* Horizontal Axis */}
      <div style={{ position: 'absolute', top: '70px', left: 0, right: 0, height: '4px', backgroundColor: 'rgba(255,255,255,0.1)' }}>
        <div style={{ width: `${lineProgress}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #f59e0b)' }} />
      </div>

      {/* Nodes */}
      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
        {events.map((evt, idx) => {
          const nodeDelay = idx * 18;
          const nodeScale = interpolate(frame, [nodeDelay, nodeDelay + 20], [0, 1], {
            easing: Easing.out(Easing.back(1.5)),
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '220px', textAlign: 'center' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: '#0f172a',
                  border: '3px solid #38bdf8',
                  boxShadow: '0 0 16px rgba(56, 189, 248, 0.6)',
                  transform: `scale(${nodeScale})`,
                  marginBottom: '20px',
                }}
              />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 800, color: '#f59e0b', marginBottom: '6px' }}>
                {evt.date}
              </span>
              <h5 style={{ fontFamily: "'Inter', sans-serif", fontSize: '15px', fontWeight: 800, color: '#f8fafc', margin: '0 0 4px 0' }}>
                {evt.headline}
              </h5>
              {evt.description && (
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                  {evt.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// 11. STATISTICAL NUMBER COUNTER
// ==========================================
export interface StatCounterProps {
  frame: number;
  targetValue: number;
  prefix?: string;
  suffix?: string;
  durationFrames?: number;
  label: string;
}
export const StatisticalCounter: FC<StatCounterProps> = ({
  frame,
  targetValue,
  prefix = '$',
  suffix = ' BILLION',
  durationFrames = 60,
  label,
}) => {
  const currentVal = Math.round(
    interpolate(frame, [0, durationFrames], [0, targetValue], {
      easing: Easing.out(Easing.cubic),
      extrapolateRight: 'clamp',
    })
  );

  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '96px',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #ffffff 40%, #38bdf8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1.05,
          letterSpacing: '-2px',
        }}
      >
        {prefix}{currentVal.toLocaleString()}{suffix}
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '16px',
          fontWeight: 800,
          color: '#94a3b8',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          marginTop: '12px',
        }}
      >
        {label}
      </div>
    </div>
  );
};

// ==========================================
// 12. GRAPH AND CHART ANIMATION
// ==========================================
export interface ChartProps {
  frame: number;
  data: Array<{ label: string; value: number }>;
  maxVal?: number;
}
export const AnimatedChart: FC<ChartProps> = ({ frame, data, maxVal = 100 }) => {
  const progress = interpolate(frame, [10, 60], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ width: '800px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '360px', padding: '0 40px', borderBottom: '2px solid rgba(255,255,255,0.2)' }}>
      {data.map((item, idx) => {
        const heightPct = (item.value / maxVal) * 100 * progress;
        return (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100px' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 800, color: '#38bdf8', marginBottom: '8px' }}>
              {Math.round(item.value * progress)}
            </span>
            <div
              style={{
                width: '60px',
                height: `${heightPct * 3}px`,
                background: 'linear-gradient(180deg, #38bdf8 0%, #1e3a8a 100%)',
                borderRadius: '6px 6px 0 0',
                boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)',
              }}
            />
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginTop: '10px' }}>
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ==========================================
// 13. MAP ROUTE ANIMATION
// ==========================================
export interface MapRouteAnimProps {
  frame: number;
  durationFrames?: number;
  fromName: string;
  toName: string;
  distanceKm: number;
}
export const MapRouteAnim: FC<MapRouteAnimProps> = ({
  frame,
  durationFrames = 90,
  fromName,
  toName,
  distanceKm,
}) => {
  const progress = interpolate(frame, [0, durationFrames], [0, 1], {
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#070d1a', overflow: 'hidden' }}>
      <svg viewBox="0 0 1920 1080" style={{ width: '100%', height: '100%' }}>
        {/* Animated Flight Arc */}
        <path
          d="M 400,600 Q 960,200 1520,600"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="4"
          strokeDasharray="14 10"
          strokeDashoffset={-frame * 3}
          style={{ filter: 'drop-shadow(0 0 10px #38bdf8)' }}
        />
        {/* Moving Aircraft */}
        <circle cx={400 + progress * 1120} cy={600 - Math.sin(progress * Math.PI) * 350} r="9" fill="#ffffff" style={{ filter: 'drop-shadow(0 0 8px #ffffff)' }} />
      </svg>
      <div style={{ position: 'absolute', top: 40, right: 60, padding: '16px 24px', backgroundColor: 'rgba(8,14,26,0.9)', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.3)' }}>
        <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#94a3b8' }}>{fromName} → {toName}</div>
        <div style={{ fontSize: '20px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, color: '#38bdf8' }}>{Math.round(distanceKm * progress).toLocaleString()} KM</div>
      </div>
    </div>
  );
};

// ==========================================
// 14. COUNTRY HIGHLIGHT ANIMATION
// ==========================================
export interface CountryHighlightProps {
  frame: number;
  countryName: string;
  strategicNote: string;
}
export const CountryHighlightAnim: FC<CountryHighlightProps> = ({ frame, countryName, strategicNote }) => {
  const pulse = Math.sin((frame / 30) * Math.PI) * 0.2 + 0.8;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          padding: '18px 32px',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          border: '2px solid #ef4444',
          borderRadius: '10px',
          boxShadow: `0 0 ${pulse * 30}px rgba(239, 68, 68, 0.7)`,
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#ef4444', fontWeight: 800, letterSpacing: '2px' }}>
          STRATEGIC THEATER DETECTED
        </span>
        <h3 style={{ fontSize: '32px', fontFamily: "'Inter', sans-serif", fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
          {countryName.toUpperCase()}
        </h3>
        <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0 }}>{strategicNote}</p>
      </div>
    </div>
  );
};

// ==========================================
// 15. DOCUMENTARY SPLIT SCREEN
// ==========================================
export interface DocumentarySplitProps {
  frame: number;
  leftMedia: string;
  rightMedia: string;
  leftLabel: string;
  rightLabel: string;
}
export const DocumentarySplit: FC<DocumentarySplitProps> = ({ frame, leftMedia, rightMedia, leftLabel, rightLabel }) => {
  const dividerH = interpolate(frame, [0, 30], [0, 100], { easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <img src={leftMedia} alt="Left side" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', bottom: 30, left: 30, padding: '8px 16px', backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: '4px', borderLeft: '3px solid #38bdf8' }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>{leftLabel}</span>
        </div>
      </div>
      {/* Animated Center Divider */}
      <div style={{ width: '4px', backgroundColor: '#38bdf8', height: `${dividerH}%`, alignSelf: 'center', zIndex: 10, boxShadow: '0 0 14px #38bdf8' }} />
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <img src={rightMedia} alt="Right side" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', bottom: 30, right: 30, padding: '8px 16px', backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: '4px', borderRight: '3px solid #ef4444' }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>{rightLabel}</span>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 16. IMAGE REVEAL (Aperture / Directional Mask)
// ==========================================
export interface ImageRevealProps {
  frame: number;
  durationFrames?: number;
  imageUrl: string;
  direction?: 'horizontal' | 'vertical' | 'circle';
}
export const ImageReveal: FC<ImageRevealProps> = ({ frame, durationFrames = 45, imageUrl, direction = 'horizontal' }) => {
  const wipe = interpolate(frame, [0, durationFrames], [0, 100], { easing: Easing.out(Easing.cubic) });
  const clipPath = direction === 'circle'
    ? `circle(${wipe}% at 50% 50%)`
    : (direction === 'vertical' ? `inset(0 0 ${100 - wipe}% 0)` : `inset(0 ${100 - wipe}% 0 0)`);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', clipPath }}>
      <img src={imageUrl} alt="Revealed content" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
};

// ==========================================
// 17. FILM-STRIP TRANSITION
// ==========================================
export interface FilmStripProps {
  frame: number;
  children: ReactNode;
}
export const FilmStripTransition: FC<FilmStripProps> = ({ frame, children }) => {
  const jitterY = (frame % 4) * 2 - 2;
  const grainOpacity = 0.05 + ((frame % 3) * 0.02);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', transform: `translateY(${jitterY}px)` }}>
      {children}
      {/* 35mm Sprocket Edge Overlays */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '40px', bottom: 0, background: 'repeating-linear-gradient(180deg, #000 0, #000 30px, #1e293b 30px, #1e293b 45px)', opacity: 0.8 }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: '40px', bottom: 0, background: 'repeating-linear-gradient(180deg, #000 0, #000 30px, #1e293b 30px, #1e293b 45px)', opacity: 0.8 }} />
    </div>
  );
};

// ==========================================
// 18. GLITCH TRANSITION
// ==========================================
export interface GlitchTransitionProps {
  frame: number;
  intensity?: number;
  children: ReactNode;
}
export const GlitchTransition: FC<GlitchTransitionProps> = ({ frame, intensity = 1.0, children }) => {
  const isGlitching = frame < 8 || (frame > 25 && frame < 30);
  const shiftX = isGlitching ? ((frame % 3) - 1) * 8 * intensity : 0;
  const rgbSplit = isGlitching ? `drop-shadow(${shiftX}px 0 red) drop-shadow(${-shiftX}px 0 cyan)` : undefined;

  return (
    <div style={{ width: '100%', height: '100%', filter: rgbSplit, transform: `translateX(${shiftX}px)` }}>
      {children}
    </div>
  );
};

// ==========================================
// 19. FLASH AND IMPACT TRANSITION
// ==========================================
export interface FlashImpactProps {
  frame: number;
  flashFrames?: number;
  children: ReactNode;
}
export const FlashImpactTransition: FC<FlashImpactProps> = ({ frame, flashFrames = 8, children }) => {
  const flashOpacity = interpolate(frame, [0, flashFrames], [0.85, 0], { extrapolateRight: 'clamp' });
  const shake = frame < 6 ? (frame % 2 === 0 ? 4 : -4) : 0;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', transform: `translate(${shake}px, ${shake * 0.5}px)` }}>
      {children}
      {flashOpacity > 0 && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: '#ffffff', opacity: flashOpacity, pointerEvents: 'none' }} />
      )}
    </div>
  );
};

// ==========================================
// 20. DOCUMENTARY CHAPTER TITLE ANIMATION
// ==========================================
export interface ChapterTitleProps {
  frame: number;
  chapterNumber: number | string;
  chapterTitle: string;
  subtitle?: string;
}
export const ChapterTitleAnim: FC<ChapterTitleProps> = ({ frame, chapterNumber, chapterTitle, subtitle }) => {
  const lineW = interpolate(frame, [15, 60], [0, 480], { easing: Easing.out(Easing.cubic) });
  const titleY = interpolate(frame, [0, 30], [30, 0], { easing: Easing.out(Easing.cubic) });
  const titleOpacity = interpolate(frame, [0, 20], [0, 1]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '14px',
          fontWeight: 800,
          color: '#f59e0b',
          letterSpacing: '5px',
          textTransform: 'uppercase',
          marginBottom: '14px',
        }}
      >
        CHAPTER {chapterNumber}
      </span>
      <h2
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '62px',
          fontWeight: 900,
          color: '#ffffff',
          textTransform: 'uppercase',
          letterSpacing: '-1px',
          margin: 0,
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
        }}
      >
        {chapterTitle}
      </h2>
      <div style={{ width: `${lineW}px`, height: '2px', backgroundColor: '#38bdf8', margin: '20px 0', boxShadow: '0 0 10px #38bdf8' }} />
      {subtitle && (
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '18px', color: '#94a3b8', maxWidth: '700px', margin: 0, lineHeight: 1.5 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

// Master dictionary of all 20 presets
export const MOTION_PRESETS_REGISTRY = {
  cinematic_slow_zoom: 'Cinematic Slow Zoom',
  smooth_push_in: 'Smooth Push-In',
  smooth_pull_out: 'Smooth Pull-Out',
  parallax_motion: 'Parallax Image Movement',
  paper_cut_collage: 'Paper-Cut Collage',
  newspaper_headline: 'Newspaper Headline Animation',
  kinetic_typography: 'Kinetic Typography',
  word_by_word_subtitles: 'Word-By-Word Subtitles',
  yellow_highlight: 'Yellow Keyword Highlighting',
  animated_timeline: 'Animated Timeline',
  statistical_counter: 'Statistical Number Counter',
  animated_chart: 'Graph & Chart Animation',
  map_route_anim: 'Map Route Animation',
  country_highlight: 'Country Highlight Animation',
  documentary_split: 'Documentary Split Screen',
  image_reveal: 'Image Reveal',
  film_strip_transition: 'Film-Strip Transition',
  glitch_transition: 'Glitch Transition',
  flash_impact_transition: 'Flash & Impact Transition',
  chapter_title_anim: 'Documentary Chapter Title Animation',
} as const;
