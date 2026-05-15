
const PATTERNS: RegExp[] = [

  /\s*[\(\[]\s*official\s*(music\s*)?video\s*[\)\]]/gi,
  /\s*[\(\[]\s*official\s*(audio|lyric|lyrics?)\s*(video)?\s*[\)\]]/gi,
  /\s*[\(\[]\s*official\s*(visualizer|visualiser)\s*[\)\]]/gi,
  /\s*[\(\[]\s*lyric[s]?\s*(video)?\s*[\)\]]/gi,
  /\s*[\(\[]\s*audio\s*[\)\]]/gi,
  /\s*[\(\[]\s*visualizer|visualiser\s*[\)\]]/gi,

  /\s*[\(\[]\s*HD\s*[\)\]]/gi,
  /\s*[\(\[]\s*4K\s*[\)\]]/gi,
  /\s*[\(\[]\s*HQ\s*[\)\]]/gi,
  /\s*[\(\[]\s*1080p\s*[\)\]]/gi,
  /\s*[\(\[]\s*720p\s*[\)\]]/gi,
  /\s*[\(\[]\s*remaster(ed)?(\s*\d{4})?\s*[\)\]]/gi,

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

  out = out.replace(/\s{2,}/g, ' ').trim();
  out = out.replace(/[\s\-–—|·]+$/, '').trim();

  return out.length > 0 ? out : title;
}

export function cleanIfPossible<T extends { title: string }>(track: T): T {
  return { ...track, title: cleanTrackTitle(track.title) };
}
