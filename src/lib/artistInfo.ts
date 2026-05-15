/**
 * Artist info service: pulls a short bio + photo from public APIs.
 *
 * Sources (no API keys required):
 *  - MusicBrainz   → resolve canonical artist + Wikipedia link
 *  - Wikipedia REST → bio extract + thumbnail
 *
 * All fetches are cached in localStorage for 24h to be polite to the
 * public APIs. Cache key is normalized lowercase artist name.
 */

const CACHE_KEY_PREFIX = 'iw_artist_v1::';
const CACHE_TTL_MS = 24 * 3600 * 1000;
const UA = 'Interwave/0.6 (https://github.com/Cloaxyyy/wave)';

export interface ArtistInfo {
  name: string;
  thumbnail_url: string | null;
  extract: string | null;
  wikipedia_url: string | null;
  fetched_at: number;
}

interface CacheEntry {
  ts: number;
  info: ArtistInfo | null;
}

function readCache(name: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + name.toLowerCase().trim());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed;
  } catch { return null; }
}

function writeCache(name: string, info: ArtistInfo | null) {
  try {
    localStorage.setItem(
      CACHE_KEY_PREFIX + name.toLowerCase().trim(),
      JSON.stringify({ ts: Date.now(), info } satisfies CacheEntry),
    );
  } catch {}
}

async function fetchMusicBrainzArtistId(name: string): Promise<{ mbid: string | null; wikipediaTitle: string | null; canonical: string | null }> {
  try {
    const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(name)}&limit=3&fmt=json`;
    const resp = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!resp.ok) return { mbid: null, wikipediaTitle: null, canonical: null };
    const json = await resp.json();
    const artists = json.artists ?? [];
    if (artists.length === 0) return { mbid: null, wikipediaTitle: null, canonical: null };
    const top = artists[0];
    return { mbid: top.id ?? null, wikipediaTitle: null, canonical: top.name ?? null };
  } catch { return { mbid: null, wikipediaTitle: null, canonical: null }; }
}

async function fetchWikipediaSummary(title: string): Promise<{ extract: string | null; thumbnail: string | null; url: string | null }> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`;
    const resp = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!resp.ok) return { extract: null, thumbnail: null, url: null };
    const json = await resp.json();
    if (json.type === 'disambiguation') {
      return { extract: null, thumbnail: null, url: null };
    }
    return {
      extract: typeof json.extract === 'string' ? json.extract : null,
      thumbnail: json.thumbnail?.source ?? json.originalimage?.source ?? null,
      url: json.content_urls?.desktop?.page ?? null,
    };
  } catch { return { extract: null, thumbnail: null, url: null }; }
}

export async function getArtistInfo(rawName: string): Promise<ArtistInfo | null> {
  const name = rawName.trim();
  if (!name || name.toLowerCase() === 'unknown' || name.toLowerCase() === 'various artists') return null;

  const cached = readCache(name);
  if (cached) return cached.info;

  const wiki1 = await fetchWikipediaSummary(`${name} (musician)`);
  if (wiki1.extract) {
    const info: ArtistInfo = {
      name,
      thumbnail_url: wiki1.thumbnail,
      extract: wiki1.extract,
      wikipedia_url: wiki1.url,
      fetched_at: Date.now(),
    };
    writeCache(name, info);
    return info;
  }

  const wiki2 = await fetchWikipediaSummary(`${name} (singer)`);
  if (wiki2.extract) {
    const info: ArtistInfo = {
      name,
      thumbnail_url: wiki2.thumbnail,
      extract: wiki2.extract,
      wikipedia_url: wiki2.url,
      fetched_at: Date.now(),
    };
    writeCache(name, info);
    return info;
  }

  const wiki3 = await fetchWikipediaSummary(`${name} (band)`);
  if (wiki3.extract) {
    const info: ArtistInfo = {
      name,
      thumbnail_url: wiki3.thumbnail,
      extract: wiki3.extract,
      wikipedia_url: wiki3.url,
      fetched_at: Date.now(),
    };
    writeCache(name, info);
    return info;
  }

  const mb = await fetchMusicBrainzArtistId(name);
  const candidate = mb.canonical ?? name;
  const wiki4 = await fetchWikipediaSummary(candidate);
  if (wiki4.extract) {
    const info: ArtistInfo = {
      name: mb.canonical ?? name,
      thumbnail_url: wiki4.thumbnail,
      extract: wiki4.extract,
      wikipedia_url: wiki4.url,
      fetched_at: Date.now(),
    };
    writeCache(name, info);
    return info;
  }

  writeCache(name, null);
  return null;
}
