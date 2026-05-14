use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, atomic::AtomicU64};
use crate::audio::thread::AudioHandle;

pub type DbPool = Pool<SqliteConnectionManager>;

/// In-memory cache of resolved YouTube stream URLs.
/// Key = youtube_id, Value = (stream_url, resolved_at).
/// URLs are typically valid for 6 hours; we expire them after 4 to be safe.
pub type UrlCache = Arc<Mutex<HashMap<String, (String, std::time::Instant)>>>;
pub const URL_CACHE_TTL_SECS: u64 = 4 * 60 * 60; // 4 hours

/// Pre-downloaded audio bytes for the next queued track.
/// Key = youtube_id, Value = raw audio bytes.
/// Evicted once consumed (play starts) or when a different track is prefetched.
pub type PrefetchCache = Arc<Mutex<HashMap<String, Vec<u8>>>>;

pub struct AppState {
    pub db: DbPool,
    pub audio: AudioHandle,
    pub poll_generation: Arc<AtomicU64>,
    pub url_cache: UrlCache,
    pub prefetch_cache: PrefetchCache,
    pub discord: crate::discord::DiscordHandle,
    pub eq: crate::audio::eq::EqSettings,
    /// Live map: action name (e.g. "play-pause") → currently bound system
    /// chord (e.g. "CommandOrControl+Shift+Space"). Updated when the user
    /// remaps a hotkey from Settings.
    pub hotkeys: crate::commands::hotkeys::HotkeyMap,
}
