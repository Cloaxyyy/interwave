// Strip "(Official Music Video)", "[HD]" etc from YouTube titles.

const PATTERNS: RegExp[] = [
  // Most common video-marker parentheticals/brackets
  /\s*[\(\[]\s*official\s*(music\s*)?video\s*[\)\]]/gi,
  /\s*[\(\[]\s*official\s*(audio|lyric|lyrics?)\s*(video)?\s*[\)\]]/gi,
  /\s*[\(\[]\s*official\s*(visualizer|visualiser)\s*[\)\]]/gi,
  /\s*[\(\[]\s*lyric[s]?\s*(video)?\s*[\)\]]/gi,
  /\s*[\(\[]\s*audio\s*[\)\]]/gi,
  /\s*[\(\[]\s*visualizer|visualiser\s*[\)\]]/gi,
  // Quality / format markers
  /\s*[\(\[]\s*HD\s*[\)\]]/gi,
  /\s*[\(\[]\s*4K\s*[\)\]]/gi,
  /\s*[\(\[]\s*HQ\s*[\)\]]/gi,
  /\s*[\(\[]\s*1080p\s*[\)\]]/gi,
  /\s*[\(\[]\s*720p\s*[\)\]]/gi,
  /\s*[\(\[]\s*remaster(ed)?(\s*\d{4})?\s*[\)\]]/gi,
  // Bare suffix tags (no parens)
  /\s+-?\s*official\s*(music\s*)?video\s*$/gi,
  /\s+-?\s*official\s*audio\s*$/gi,
  /\s+-?\s*lyric[s]?\s*video\s*$/gi,
  /\s+-?\s*HD\s*$/gi,
  /\s+-?\s*4K\s*$/gi,
];

export function cleanTrackTitle(title: string): string {
  if (!title) return title;
  let out = title;
  for (const p of PATTERNS) out = out.replace(p, '');
  // Collapse runs of whitespace and trim leftover junk like " - "
  out = out.replace(/\s{2,}/g, ' ').trim();
  out = out.replace(/[\s\-–—|·]+$/, '').trim();
  // If we accidentally stripped everything, return the original
  return out.length > 0 ? out : title;
}

/** Same logic but for SearchResults / Track display — wraps in passthrough. */
export function cleanIfPossible<T extends { title: string }>(track: T): T {
  return { ...track, title: cleanTrackTitle(track.title) };
}
