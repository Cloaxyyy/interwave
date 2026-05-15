use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, atomic::AtomicU64};
use crate::audio::thread::AudioHandle;

pub type DbPool = Pool<SqliteConnectionManager>;

pub type UrlCache = Arc<Mutex<HashMap<String, (String, std::time::Instant)>>>;
pub const URL_CACHE_TTL_SECS: u64 = 4 * 60 * 60;

pub type PrefetchCache = Arc<Mutex<HashMap<String, Vec<u8>>>>;

pub struct AppState {
    pub db: DbPool,
    pub audio: AudioHandle,
    pub poll_generation: Arc<AtomicU64>,
    pub url_cache: UrlCache,
    pub prefetch_cache: PrefetchCache,
    pub discord: crate::discord::DiscordHandle,
    pub eq: crate::audio::eq::EqSettings,
    pub hotkeys: crate::commands::hotkeys::HotkeyMap,
}
