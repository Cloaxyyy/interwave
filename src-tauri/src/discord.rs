
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::mpsc::RecvTimeoutError;
use std::time::{Duration, Instant};

#[derive(Clone)]
pub struct DiscordHandle {
    tx: std::sync::mpsc::SyncSender<DiscordMsg>,
}

enum DiscordMsg {
    Update { title: String, artist: String, art_url: Option<String>, started_at: i64 },
    Clear,
    #[allow(dead_code)]
    Shutdown,
}

impl DiscordHandle {
    pub fn update(&self, title: String, artist: String, art_url: Option<String>) {
        let started_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        let _ = self.tx.try_send(DiscordMsg::Update { title, artist, art_url, started_at });
    }

    pub fn clear(&self) {
        let _ = self.tx.try_send(DiscordMsg::Clear);
    }
}

const APP_ID: &str = "1229832201817030707";

pub fn spawn() -> DiscordHandle {
    let (tx, rx) = std::sync::mpsc::sync_channel::<DiscordMsg>(8);

    std::thread::spawn(move || {
        let mut client = match DiscordIpcClient::new(APP_ID) {
            Ok(c) => c,
            Err(e) => {
                log::warn!("Discord: failed to create IPC client: {e}");
                while let Ok(msg) = rx.recv() {
                    if matches!(msg, DiscordMsg::Shutdown) { break; }
                }
                return;
            }
        };

        let mut connected = false;
        let mut last_retry = Instant::now() - Duration::from_secs(60);
        let mut last_activity: Option<(String, String, Option<String>, i64)> = None;

        let try_connect = |client: &mut DiscordIpcClient,
                           connected: &mut bool,
                           last_retry: &mut Instant| {
            if *connected { return; }
            if last_retry.elapsed() < Duration::from_secs(30) { return; }
            *last_retry = Instant::now();
            match client.connect() {
                Ok(()) => {
                    log::info!("Discord Rich Presence connected");
                    *connected = true;
                }
                Err(e) => {
                    log::debug!("Discord not running ({e}); will retry");
                }
            }
        };

        try_connect(&mut client, &mut connected, &mut last_retry);

        loop {
            match rx.recv_timeout(Duration::from_secs(15)) {
                Err(RecvTimeoutError::Timeout) => {
                    if !connected {
                        try_connect(&mut client, &mut connected, &mut last_retry);
                        if connected {
                            if let Some((title, artist, art, started)) = last_activity.clone() {
                                let payload = build_activity(&title, &artist, art.as_deref(), started);
                                if let Err(e) = client.set_activity(payload) {
                                    log::warn!("Discord: re-set_activity failed: {e}");
                                    connected = false;
                                }
                            }
                        }
                    }
                }
                Err(RecvTimeoutError::Disconnected) => break,
                Ok(DiscordMsg::Shutdown) => break,
                Ok(DiscordMsg::Clear) => {
                    last_activity = None;
                    if connected {
                        let _ = client.clear_activity();
                    }
                }
                Ok(DiscordMsg::Update { title, artist, art_url, started_at }) => {
                    last_activity = Some((title.clone(), artist.clone(), art_url.clone(), started_at));
                    try_connect(&mut client, &mut connected, &mut last_retry);
                    if !connected { continue; }
                    let payload = build_activity(&title, &artist, art_url.as_deref(), started_at);
                    if let Err(e) = client.set_activity(payload) {
                        log::warn!("Discord: set_activity failed: {e}");
                        connected = false;
                    }
                }
            }
        }

        let _ = client.close();
    });

    DiscordHandle { tx }
}

fn build_activity<'a>(
    title: &'a str,
    artist: &'a str,
    art_url: Option<&'a str>,
    started_at: i64,
) -> activity::Activity<'a> {
    let mut assets = activity::Assets::new()
        .small_image("wave_logo")
        .small_text("Interwave");
    if let Some(url) = art_url {
        assets = assets.large_image(url).large_text(title);
    } else {
        assets = assets.large_image("wave_logo").large_text("Interwave Music");
    }
    activity::Activity::new()
        .state(artist)
        .details(title)
        .timestamps(activity::Timestamps::new().start(started_at))
        .assets(assets)
}
