interface Props {
  src?: string | null;
  glyph?: string;
  hue?: number;
  size?: number | string;
  rounded?: number;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}

function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return Math.abs(h % 360);
}

export default function Cover({
  src, glyph, hue, size, rounded = 8, alt, className, style,
}: Props) {
  const dim = typeof size === 'number' ? `${size}px` : size;
  const computedHue = hue ?? (glyph ? hueFromString(glyph) : 280);
  const baseStyle: React.CSSProperties = {
    width: dim ?? '100%',
    ...(typeof size === 'number' ? { height: dim } : { aspectRatio: '1' }),
    borderRadius: rounded,
    overflow: 'hidden',
    flexShrink: 0,
    position: 'relative',
    ...style,
  };

  if (src) {
    return (
      <div className={className} style={baseStyle}>
        <img
          src={src}
          alt={alt ?? ''}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }

  return (
    <div className={`iw-cover ${className ?? ''}`} style={baseStyle}>
      <div className="iw-swirl" style={{ ['--iw-cover-h' as any]: computedHue } as React.CSSProperties} />
      <div className="iw-grain" />
      {glyph && <div className="iw-glyph">{glyph[0]?.toUpperCase()}</div>}
    </div>
  );
}
