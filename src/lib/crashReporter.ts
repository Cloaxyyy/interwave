const KEY = 'iw_crash_log_v1';
const MAX_ENTRIES = 50;

interface CrashEntry {
  ts: number;
  kind: 'error' | 'unhandled' | 'rejection';
  message: string;
  stack?: string;
  url?: string;
}

function read(): CrashEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function write(entries: CrashEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {}
}

function record(entry: CrashEntry) {
  const list = read();
  list.push(entry);
  write(list);
}

let installed = false;
export function initCrashReporter() {
  if (installed) return;
  installed = true;

  window.addEventListener('error', (e) => {
    record({
      ts: Date.now(),
      kind: 'unhandled',
      message: e.message,
      stack: e.error?.stack,
      url: `${e.filename}:${e.lineno}:${e.colno}`,
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    record({
      ts: Date.now(),
      kind: 'rejection',
      message: reason?.message ?? String(reason),
      stack: reason?.stack,
    });
  });
}

export function getDiagnostics(version: string): string {
  const log = read();
  const now = new Date().toISOString();
  const ua = navigator.userAgent;
  const lines: string[] = [
    `--- Interwave Diagnostics ---`,
    `generated: ${now}`,
    `version: ${version}`,
    `userAgent: ${ua}`,
    `crashes: ${log.length}`,
    ``,
  ];
  for (const e of log.slice().reverse()) {
    lines.push(`[${new Date(e.ts).toISOString()}] ${e.kind.toUpperCase()}`);
    lines.push(`  ${e.message}`);
    if (e.url) lines.push(`  at ${e.url}`);
    if (e.stack) {
      const first3 = e.stack.split('\n').slice(0, 4).map((l) => `  ${l}`).join('\n');
      lines.push(first3);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function clearCrashLog() {
  try { localStorage.removeItem(KEY); } catch {}
}

export function crashCount(): number {
  return read().length;
}
