// Dominant-colour extractor — returns an OKLCH string from an image URL.

const CACHE = new Map<string, string>();
const FALLBACK = 'oklch(0.72 0.18 295)';

export async function extractAccentColor(url: string | null | undefined): Promise<string> {
  if (!url) return FALLBACK;
  const cached = CACHE.get(url);
  if (cached) return cached;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';

    const done = (color: string) => {
      CACHE.set(url, color);
      resolve(color);
    };

    img.onload = () => {
      try {
        const c = pickDominant(img);
        done(c);
      } catch {
        done(FALLBACK);
      }
    };
    img.onerror = () => done(FALLBACK);
    img.src = url;

    // Don't wait forever
    setTimeout(() => done(FALLBACK), 4000);
  });
}

function pickDominant(img: HTMLImageElement): string {
  const W = 64, H = 64;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no canvas ctx');
  ctx.drawImage(img, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H).data;

  // Buckets keyed by quantised hue
  const buckets = new Map<number, { score: number; r: number; g: number; b: number; n: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
    if (a < 128) continue;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const lum = (max + min) / 2 / 255;
    if (lum < 0.10 || lum > 0.92) continue;            // skip near-black/white

    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.18) continue;                          // skip greys

    const h = rgbHue(r, g, b);                         // 0..360
    const bucket = Math.round(h / 12) * 12;            // 12° bins
    const cur = buckets.get(bucket) ?? { score: 0, r: 0, g: 0, b: 0, n: 0 };
    // Saturated vivid colours score higher; mid-luminance preferred
    const score = sat * (0.6 + 0.8 * (1 - Math.abs(lum - 0.55)));
    cur.score += score;
    cur.r += r; cur.g += g; cur.b += b; cur.n++;
    buckets.set(bucket, cur);
  }

  if (buckets.size === 0) return FALLBACK;

  // Pick the highest-scoring bucket and return its average colour
  let best: typeof buckets extends Map<number, infer V> ? V : never = null as any;
  for (const v of buckets.values()) {
    if (!best || v.score > best.score) best = v;
  }
  const r = best.r / best.n, g = best.g / best.n, b = best.b / best.n;
  return rgbToOklch(r, g, b);
}

function rgbHue(r: number, g: number, b: number): number {
  const rN = r / 255, gN = g / 255, bN = b / 255;
  const max = Math.max(rN, gN, bN), min = Math.min(rN, gN, bN);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === rN)      h = ((gN - bN) / d) % 6;
  else if (max === gN) h = (bN - rN) / d + 2;
  else                 h = (rN - gN) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

// Cheap RGB → OKLCH approximation (we only need *a* hue/chroma/lightness;
// don't ship the full transformation matrix). Tweak L+C to keep the accent
// readable as a UI tint rather than blasting like the cover.
function rgbToOklch(r: number, g: number, b: number): string {
  const lumLinear = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const L = clamp(0.55 + (lumLinear / 255) * 0.20, 0.55, 0.78);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const C = clamp(0.10 + sat * 0.14, 0.10, 0.22);
  const H = rgbHue(r, g, b);
  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
