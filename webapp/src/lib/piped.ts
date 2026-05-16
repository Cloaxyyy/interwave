// Piped is an open-source YouTube frontend exposing CORS-enabled public APIs.
// We fetch /streams/{videoId} and pick the best audio-only stream URL.
//
// Public instance list intentionally includes a few mirrors — they go down
// individually fairly often, so we fall through on any error.

const PIPED_INSTANCES: readonly string[] = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.r4fo.com',
  'https://pipedapi.darkness.services',
] as const;

const INSTANCE_TIMEOUT_MS = 6000;
// Piped pre-signed URLs expire ~6h. Cache for 5h to be safe.
const CACHE_TTL_MS = 5 * 60 * 60 * 1000;

export interface ResolvedStream {
  url: string;
  mimeType: string;
  bitrate: number;
}

interface CachedStream extends ResolvedStream {
  expiresAt: number;
}

interface PipedAudioStream {
  url: string;
  mimeType: string;
  codec?: string;
  bitrate?: number;
  format?: string;
  quality?: string;
}

interface PipedStreamsResponse {
  audioStreams?: PipedAudioStream[];
}

const cache = new Map<string, CachedStream>();

function pickBestStream(streams: PipedAudioStream[]): ResolvedStream | null {
  if (streams.length === 0) return null;

  // Rank: prefer audio/mp4 (m4a/aac) or audio/webm (opus), avoid audio/mp3
  // when alternatives exist. Within preferred types, take highest bitrate.
  const score = (s: PipedAudioStream): number => {
    const mime = (s.mimeType ?? '').toLowerCase();
    if (mime.includes('mp4') || mime.includes('m4a')) return 3;
    if (mime.includes('webm') || mime.includes('opus')) return 2;
    if (mime.includes('mpeg') || mime.includes('mp3')) return 1;
    return 0;
  };

  const sorted = [...streams].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sb - sa;
    return (b.bitrate ?? 0) - (a.bitrate ?? 0);
  });

  const best = sorted[0];
  if (!best?.url) return null;
  return {
    url: best.url,
    mimeType: best.mimeType ?? 'audio/mp4',
    bitrate: best.bitrate ?? 0,
  };
}

type InstanceResult = ResolvedStream | { notFound: true } | null;

async function tryInstance(instance: string, videoId: string): Promise<InstanceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INSTANCE_TIMEOUT_MS);
  try {
    const res = await fetch(`${instance}/streams/${encodeURIComponent(videoId)}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    // 404/410 = the video itself is gone — no point trying other instances.
    if (res.status === 404 || res.status === 410) return { notFound: true };
    if (!res.ok) return null;
    const json = (await res.json()) as PipedStreamsResponse;
    const streams = json.audioStreams ?? [];
    return pickBestStream(streams);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveStream(videoId: string): Promise<ResolvedStream> {
  const cached = cache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return { url: cached.url, mimeType: cached.mimeType, bitrate: cached.bitrate };
  }

  for (const instance of PIPED_INSTANCES) {
    const result = await tryInstance(instance, videoId);
    if (result && 'notFound' in result) {
      throw new Error('Video not available');
    }
    if (result) {
      cache.set(videoId, { ...result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    }
  }

  throw new Error('All Piped instances failed');
}

export function clearStreamCache(): void {
  cache.clear();
}
