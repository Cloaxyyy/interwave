<div align="center">

# Interwave

A music player that's fast, private, and yours.

[![Latest release](https://img.shields.io/github/v/release/Cloaxyyy/interwave?style=flat-square&color=8a5cf6&label=latest)](https://github.com/Cloaxyyy/interwave/releases/latest)
[![Build status](https://img.shields.io/github/actions/workflow/status/Cloaxyyy/interwave/build-windows.yml?branch=main&style=flat-square&color=8a5cf6)](https://github.com/Cloaxyyy/interwave/actions)
[![License](https://img.shields.io/badge/license-MIT-8a5cf6?style=flat-square)](LICENSE)

[Download for Windows](https://github.com/Cloaxyyy/interwave/releases/latest) · [What's new](https://github.com/Cloaxyyy/interwave/releases) · [Report a bug](https://github.com/Cloaxyyy/interwave/issues/new)

</div>

---

Interwave is a desktop music player built around three things: it's free, it doesn't track you, and it auto-updates so you never have to redownload it. Search anything, play it instantly, get karaoke-style synced lyrics that fill in word-by-word, and let the whole UI re-tint to match the cover art on every track change.

## Features

- **Search any song** — type, hit enter, play. Powered by YouTube's catalog with live recommendations.
- **Karaoke lyrics** — synced lyrics with per-word reveal, Fullscreen mode optional.
- **Live colour from album art** — every surface (player bar, sidebar, panel, hero) re-tints to the current cover. Each song has its own atmosphere.
- **Resizable, hideable Now Playing panel** — drag the left edge to resize,
- **Custom hotkeys** — both in-app keys and global system-wide chord shortcuts (Ctrl+Shift+Space etc.) that work even in fullscreen games.
- **Discord Rich Presence** — your status shows the cover art of what you're listening to.
- **Auto-updater** — silent check every 5 minutes, one-click restart to install. Set up once, never download manually again.
- **Spotify import** — paste a Spotify playlist URL or drop a JSON export. Tracks are matched on YouTube and added in order.
- **Crash recovery** — if Interwave dies mid-song, the next launch offers to resume from where you left off.
- **Built-in moderation** — admin panel for community owners: suspend accounts, ban IPs, broadcast announcements, set per-page maintenance.
- **Privacy first** — local SQLite library. Optional Supabase sync for cross-device. No telemetry, no ads.
- **And so Much more!**
## Install

[Download the Windows installer](https://github.com/Cloaxyyy/interwave/releases/latest) (`interwave_X.Y.Z_x64-setup.exe`).

After your first install, every subsequent update arrives automatically — a small "Update available — Restart" pill appears in the bottom-right when a new version is published. One click and you're on the new build.

> First launch will warn about an "unknown publisher" because Interwave isn't code-signed (paid certificate, not in the budget yet). Click **More info → Run anyway**.

## Stack

- **Tauri 2** — Rust audio + React UI in a 23 MB native binary
- **Rust + rodio + symphonia** — audio decode and playback
- **React 19 + TypeScript + Vite** — frontend
- **SQLite** (via rusqlite) — local library


## Contributing

Bug reports + feature requests welcome via GitHub Issues. PRs welcome too — open an issue first if it's a big change so we can talk shape.

## License

MIT. Use it (anytime), fork it (always), sell it (no — see "About YouTube" below).

## About YouTube

Interwave streams audio from YouTube's CDN via the InnerTube API. This is a grey area in YouTube's ToS — fine for personal use, not appropriate as a paid product. Interwave is therefore **always free** and we don't accept payment for it. If that ever changes the project would need a real licensing deal with the labels (which would mean it isn't really Interwave any more).
