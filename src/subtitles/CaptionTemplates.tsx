import React from 'react';

export type CaptionTemplateId =
  | 'minimal-white'
  | 'bold-keyword'
  | 'karaoke-highlight'
  | 'word-by-word-pop'
  | 'documentary-serif'
  | 'news-lower-third'
  | 'typewriter'
  | 'clean-two-line'
  | 'boxed-caption'
  | 'outline-caption'
  | 'highlight-bar'
  | 'minimal-center'
  | 'hinglish-caption'
  | 'chapter-caption'
  | 'cinematic-editorial';

export interface CaptionConfig {
  template: CaptionTemplateId;
  fontSize?: number;
  textColor?: string;
  highlightColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  position?: 'bottom' | 'center' | 'top';
}

export interface CaptionRendererProps {
  text: string;
  config: CaptionConfig;
  chapterTitle?: string;
}

export const CaptionRenderer: React.FC<CaptionRendererProps> = ({
  text,
  config,
  chapterTitle = 'STRATEGIC OVERVIEW'
}) => {
  const {
    template = 'minimal-white',
    fontSize = 32,
    textColor = '#ffffff',
    highlightColor = '#ffcc00',
    backgroundColor = 'rgba(0,0,0,0.7)',
    fontFamily = "'Inter', system-ui, sans-serif",
    position = 'bottom'
  } = config;

  const getPositionStyle = (): React.CSSProperties => {
    switch (position) {
      case 'top': return { top: '80px', bottom: 'auto' };
      case 'center': return { top: '50%', transform: 'translateY(-50%)' };
      default: return { bottom: '80px', top: 'auto' };
    }
  };

  const baseContainerStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '90%',
    maxWidth: '1200px',
    textAlign: 'center',
    pointerEvents: 'none',
    zIndex: 100,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    ...getPositionStyle()
  };

  // 1. Minimal White
  if (template === 'minimal-white') {
    return (
      <div style={baseContainerStyle}>
        <span style={{
          fontFamily,
          fontSize: `${fontSize}px`,
          fontWeight: 600,
          color: '#ffffff',
          textShadow: '0 2px 10px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.9)',
          lineHeight: 1.4,
        }}>
          {text}
        </span>
      </div>
    );
  }

  // 2. Bold Keyword
  if (template === 'bold-keyword') {
    const words = text.split(' ');
    return (
      <div style={baseContainerStyle}>
        <div style={{
          fontFamily,
          fontSize: `${fontSize}px`,
          fontWeight: 700,
          color: textColor,
          textShadow: '0 3px 12px rgba(0,0,0,0.9)',
          lineHeight: 1.4,
        }}>
          {words.map((w, idx) => (
            <span
              key={idx}
              style={{
                color: idx % 3 === 1 ? highlightColor : textColor,
                textTransform: idx % 3 === 1 ? 'uppercase' : 'none',
                marginRight: '8px',
              }}
            >
              {w}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // 3. Karaoke Highlight
  if (template === 'karaoke-highlight') {
    return (
      <div style={baseContainerStyle}>
        <span style={{
          fontFamily,
          fontSize: `${fontSize}px`,
          fontWeight: 800,
          background: `linear-gradient(90deg, ${highlightColor} 60%, ${textColor} 60%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 4px 15px rgba(0,0,0,0.6)',
        }}>
          {text}
        </span>
      </div>
    );
  }

  // 4. Word-by-Word Pop
  if (template === 'word-by-word-pop') {
    return (
      <div style={baseContainerStyle}>
        <div style={{
          fontFamily,
          fontSize: `${fontSize * 1.1}px`,
          fontWeight: 900,
          color: highlightColor,
          textShadow: '0 4px 20px rgba(0,0,0,0.9)',
          letterSpacing: '-0.5px'
        }}>
          {text}
        </div>
      </div>
    );
  }

  // 5. Documentary Serif
  if (template === 'documentary-serif') {
    return (
      <div style={baseContainerStyle}>
        <div style={{
          fontFamily: "'Georgia', serif",
          fontSize: `${fontSize}px`,
          fontStyle: 'italic',
          color: '#f8f5ee',
          textShadow: '0 2px 8px rgba(0,0,0,0.9)',
          letterSpacing: '0.5px',
          borderBottom: '1px solid rgba(255,255,255,0.3)',
          paddingBottom: '8px'
        }}>
          {text}
        </div>
      </div>
    );
  }

  // 6. News Lower Third
  if (template === 'news-lower-third') {
    return (
      <div style={{ ...baseContainerStyle, justifyContent: 'flex-start', left: '10%', transform: 'none' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}>
          <div style={{
            background: '#b91c1c',
            color: '#fff',
            padding: '4px 14px',
            fontSize: '14px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            BREAKING REPORT
          </div>
          <div style={{
            background: 'rgba(15,23,42,0.95)',
            borderLeft: '4px solid #b91c1c',
            padding: '10px 18px',
            color: '#fff',
            fontSize: `${fontSize * 0.9}px`,
            fontWeight: 600,
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            {text}
          </div>
        </div>
      </div>
    );
  }

  // 7. Typewriter
  if (template === 'typewriter') {
    return (
      <div style={baseContainerStyle}>
        <div style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: `${fontSize}px`,
          fontWeight: 700,
          color: '#10b981',
          background: 'rgba(0,0,0,0.85)',
          padding: '8px 16px',
          borderRadius: '4px',
          border: '1px solid #10b981'
        }}>
          {text}_
        </div>
      </div>
    );
  }

  // 8. Clean Two-Line
  if (template === 'clean-two-line') {
    return (
      <div style={baseContainerStyle}>
        <div style={{
          fontFamily,
          fontSize: `${fontSize}px`,
          fontWeight: 600,
          color: '#ffffff',
          lineHeight: 1.5,
          textShadow: '0 2px 10px rgba(0,0,0,0.8)',
          maxWidth: '800px'
        }}>
          {text}
        </div>
      </div>
    );
  }

  // 9. Boxed Caption
  if (template === 'boxed-caption') {
    return (
      <div style={baseContainerStyle}>
        <div style={{
          fontFamily,
          fontSize: `${fontSize * 0.9}px`,
          fontWeight: 700,
          color: '#ffffff',
          background: backgroundColor,
          padding: '10px 24px',
          borderRadius: '8px',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          {text}
        </div>
      </div>
    );
  }

  // 10. Outline Caption
  if (template === 'outline-caption') {
    return (
      <div style={baseContainerStyle}>
        <div style={{
          fontFamily,
          fontSize: `${fontSize * 1.1}px`,
          fontWeight: 900,
          color: '#ffffff',
          WebkitTextStroke: '2px #000000',
          textShadow: '0 0 20px rgba(0,0,0,0.8)',
          textTransform: 'uppercase'
        }}>
          {text}
        </div>
      </div>
    );
  }

  // 11. Highlight Bar
  if (template === 'highlight-bar') {
    return (
      <div style={baseContainerStyle}>
        <span style={{
          fontFamily,
          fontSize: `${fontSize}px`,
          fontWeight: 700,
          color: '#000000',
          backgroundColor: highlightColor,
          padding: '4px 12px',
          boxDecorationBreak: 'clone',
          WebkitBoxDecorationBreak: 'clone',
        }}>
          {text}
        </span>
      </div>
    );
  }

  // 12. Minimal Center
  if (template === 'minimal-center') {
    return (
      <div style={{ ...baseContainerStyle, top: '45%', bottom: 'auto' }}>
        <div style={{
          fontFamily,
          fontSize: `${fontSize * 1.2}px`,
          fontWeight: 500,
          color: '#ffffff',
          textShadow: '0 4px 16px rgba(0,0,0,0.9)',
          letterSpacing: '-0.3px'
        }}>
          {text}
        </div>
      </div>
    );
  }

  // 13. Hinglish Caption
  if (template === 'hinglish-caption') {
    return (
      <div style={baseContainerStyle}>
        <div style={{
          fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif",
          fontSize: `${fontSize}px`,
          fontWeight: 700,
          color: '#fef08a',
          textShadow: '0 2px 8px rgba(0,0,0,0.9)',
          background: 'rgba(0,0,0,0.6)',
          padding: '6px 18px',
          borderRadius: '6px'
        }}>
          {text}
        </div>
      </div>
    );
  }

  // 14. Chapter Caption
  if (template === 'chapter-caption') {
    return (
      <div style={{ ...baseContainerStyle, flexDirection: 'column' }}>
        <div style={{
          fontFamily,
          fontSize: '14px',
          fontWeight: 800,
          color: highlightColor,
          letterSpacing: '3px',
          textTransform: 'uppercase',
          marginBottom: '6px'
        }}>
          CHAPTER // {chapterTitle}
        </div>
        <div style={{
          fontFamily,
          fontSize: `${fontSize}px`,
          fontWeight: 600,
          color: '#ffffff',
          textShadow: '0 2px 10px rgba(0,0,0,0.8)'
        }}>
          {text}
        </div>
      </div>
    );
  }

  // 15. Cinematic Editorial
  return (
    <div style={baseContainerStyle}>
      <div style={{
        fontFamily: "'Cinzel', 'Times New Roman', serif",
        fontSize: `${fontSize * 0.95}px`,
        fontWeight: 600,
        color: '#e2e8f0',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        textShadow: '0 4px 20px rgba(0,0,0,0.9)'
      }}>
        {text}
      </div>
    </div>
  );
};
