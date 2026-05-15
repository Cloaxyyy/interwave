# Privacy Policy

_Last updated: May 14, 2026_

Interwave is built around the idea that what you listen to is your business. This document explains exactly what data leaves your machine and why.

## Short version

- **Local-first.** Your library, playlists, play counts, and listening history live in a SQLite database **on your computer**. They never leave unless you sign in.
- **No telemetry.** Interwave doesn't track you, doesn't ping a server when you open it, and doesn't have an analytics provider.
- **No ads.** Ever.
- If you sign in with an email + password, the bullet points below explain what we store.

## What we store when you sign in

If you sign in to enable cross-device sync or admin features, the following is stored on the project's managed backend:

| Data | Why |
|---|---|
| Email + password (hashed) | Authenticate you |
| Display name | Show in profile + admin UI |
| Library + playlist data (when you opt into sync) | Sync across your devices |
| The IP address you signed in from | Moderation — banning abusive IPs |
| User-agent string | Same as above; identifying which OS/browser combination an account uses |
| Sign-in timestamps | Activity log for support + abuse investigations |
| Any moderation actions taken on your account | Suspension history, role changes |

**That's it.** We do not store:

- what songs you play
- what you search for
- how long you listen
- microphone audio, screen contents, or anything else not in the table above

## What never leaves your machine

- Your full play history
- Your local library (unless you turn on cloud sync)
- Your search queries
- Your equalizer settings, hotkey customisations, accent colour
- Your downloaded tracks (Library → Download)
- Crash logs (saved to `%AppData%\app.interwave.player\interwave-crash.log` for your own debugging — never automatically uploaded)

## Auto-updater

Interwave periodically polls **GitHub Releases** to check whether a new version exists. The poll is anonymous — GitHub sees a request from your IP, but no identifier is attached. If there's an update, the signed payload is downloaded and verified locally. We don't see who updated when.

## Discord Rich Presence

If you have Discord installed and running, Interwave sets your status to whatever song is playing. **This goes through Discord's IPC, not our servers.** We never see what you set; Discord does. To turn this off, quit Discord before opening Interwave (or remove the Discord application ID from `discord.rs` if you build from source).

## Lyrics

Lyrics are fetched from **LRClib** (`lrclib.net`), a free public lyrics database. Your search query (track title + artist) is sent to them. We don't store the request and don't proxy it through our servers — your machine talks to LRClib directly.

## Spotify imports

If you paste a Spotify playlist URL, Interwave fetches the public embed page from `open.spotify.com`. Your IP is visible to Spotify; no Interwave server sees the request.

## YouTube playback

Audio streams come from YouTube's CDN (`*.googlevideo.com`). Your IP is visible to Google. We don't proxy these — your machine talks to YouTube directly.

## Moderation actions

If you're suspended or your IP is banned, that record persists indefinitely on the managed backend so the suspension can be enforced. Lifted suspensions remain in the audit log forever for transparency.

## Your rights

You can:

- Delete your account by contacting a staff member, which removes your row from `auth.users`. Cascade deletes wipe your `user_roles`, `user_login_log`, `account_suspensions`, etc.
- Export everything we have on you by asking a staff member.
- Use Interwave with no account at all (downside: no cross-device sync, no admin features). _Not currently exposed in the UI; we may add it back as a "local-only mode" toggle in a future build._

## Changes

If this policy changes materially, the in-app announcement banner notifies you. Old versions are kept in the GitHub repository for transparency.

## Contact

Issue a request via <https://github.com/Cloaxyyy/wave/issues>.
