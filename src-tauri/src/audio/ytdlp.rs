use crate::error::{WaveError, WaveResult};
use std::path::PathBuf;

const YTDLP_TIMEOUT_SECS: u64 = 30;

#[derive(Debug, Clone, PartialEq)]
enum AudioKind { Webm, M4a }

struct AudioCandidate {
    kind:    AudioKind,
    bitrate: u64,
    url:     String,
}

fn extract_audio_url(json: &serde_json::Value) -> WaveResult<String> {
    if let Some(status) = json["playabilityStatus"]["status"].as_str() {
        if status != "OK" {
            let reason = json["playabilityStatus"]["reason"]
                .as_str()
                .unwrap_or("unknown");
            return Err(WaveError::YtDlp(format!("video not playable: {reason}")));
        }
    }

    let streaming = &json["streamingData"];
    if streaming.is_null() {
        return Err(WaveError::YtDlp("no streamingData in response".into()));
    }

    let empty = serde_json::Value::Array(vec![]);
    let adaptive = streaming["adaptiveFormats"].as_array().unwrap_or_else(|| {
        empty.as_array().unwrap()
    });
    let combined = streaming["formats"].as_array().unwrap_or_else(|| {
        empty.as_array().unwrap()
    });

    let all_formats: Vec<&serde_json::Value> = adaptive.iter().chain(combined.iter()).collect();

    if all_formats.is_empty() {
        return Err(WaveError::YtDlp("no formats in streamingData response".into()));
    }

    let mut best: Option<AudioCandidate> = None;

    for fmt in all_formats {
        let mime = fmt["mimeType"].as_str().unwrap_or("");

        let kind = if mime.starts_with("audio/webm") {
            AudioKind::Webm
        } else if mime.starts_with("audio/mp4") {
            AudioKind::M4a
        } else {
            continue;
        };

        let url = match fmt["url"].as_str() {
            Some(u) if !u.is_empty() => u.to_string(),
            _ => continue,
        };

        let bitrate = fmt["bitrate"].as_u64().unwrap_or(0);

        let better = match &best {
            None => true,
            Some(b) => {
                (kind == AudioKind::M4a && b.kind == AudioKind::Webm)
                    || (kind == b.kind && bitrate > b.bitrate)
            }
        };

        if better {
            best = Some(AudioCandidate { kind, bitrate, url });
        }
    }

    let candidate = best.ok_or_else(|| {
        WaveError::YtDlp("no usable audio URL found (all need cipher or unsupported format)".into())
    })?;

    log::debug!(
        "selected {} @ {}bps",
        if candidate.kind == AudioKind::Webm { "webm/opus" } else { "m4a/aac" },
        candidate.bitrate
    );
    Ok(candidate.url)
}

async fn innertube_request(
    client: &reqwest::Client,
    client_name_id: &str,
    version: &str,
    user_agent: &str,
    extra_origin: bool,
    body: serde_json::Value,
) -> WaveResult<String> {
    let mut req = client
        .post("https://www.youtube.com/youtubei/v1/player?prettyPrint=false")
        .header("Content-Type", "application/json")
        .header("X-YouTube-Client-Name", client_name_id)
        .header("X-YouTube-Client-Version", version)
        .header("User-Agent", user_agent);

    if extra_origin {
        req = req
            .header("Origin", "https://www.youtube.com")
            .header("Referer", "https://www.youtube.com/");
    }

    let json: serde_json::Value = req
        .json(&body)
        .send()
        .await
        .map_err(|e| WaveError::Network(e.to_string()))?
        .json()
        .await
        .map_err(|e| WaveError::Network(e.to_string()))?;

    extract_audio_url(&json)
}

pub async fn resolve_stream_url_innertube(video_id: &str) -> WaveResult<String> {
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(8))
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| WaveError::Network(e.to_string()))?;

    let (tx, mut rx) = tokio::sync::mpsc::channel::<WaveResult<String>>(10);

    {
        let c = client.clone();
        let vid = video_id.to_string();
        let tx = tx.clone();
        let body = serde_json::json!({
            "context": { "client": {
                "clientName": "ANDROID",
                "clientVersion": "19.44.38",
                "androidSdkVersion": 30,
                "userAgent": "com.google.android.youtube/19.44.38 (Linux; U; Android 11) gzip",
                "hl": "en", "gl": "US"
            }},
            "videoId": vid,
            "params": "8AEB"
        });
        tokio::spawn(async move {
            let r = innertube_request(&c, "3", "19.44.38",
                "com.google.android.youtube/19.44.38 (Linux; U; Android 11) gzip",
                false, body).await;
            log::debug!("ANDROID: {:?}", r.as_ref().map(|_| "ok").map_err(|e| e.to_string()));
            let _ = tx.send(r).await;
        });
    }

    {
        let c = client.clone();
        let vid = video_id.to_string();
        let tx = tx.clone();
        let body = serde_json::json!({
            "context": { "client": {
                "clientName": "IOS",
                "clientVersion": "19.45.4",
                "deviceMake": "Apple",
                "deviceModel": "iPhone16,2",
                "osName": "iPhone",
                "osVersion": "18.1.0.22B83",
                "userAgent": "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)",
                "hl": "en", "gl": "US"
            }},
            "videoId": vid,
            "params": "8AEB"
        });
        tokio::spawn(async move {
            let r = innertube_request(&c, "5", "19.45.4",
                "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)",
                false, body).await;
            log::debug!("IOS: {:?}", r.as_ref().map(|_| "ok").map_err(|e| e.to_string()));
            let _ = tx.send(r).await;
        });
    }

    {
        let c = client.clone();
        let vid = video_id.to_string();
        let tx = tx.clone();
        let body = serde_json::json!({
            "context": { "client": {
                "clientName": "ANDROID_VR",
                "clientVersion": "1.60.19",
                "deviceMake": "Oculus",
                "deviceModel": "Quest 3",
                "androidSdkVersion": 32,
                "hl": "en", "gl": "US"
            }},
            "videoId": vid,
            "params": "8AEB"
        });
        tokio::spawn(async move {
            let r = innertube_request(&c, "28", "1.60.19",
                "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12; eureka-user Build/SQ3A.220605.009.A1) gzip",
                false, body).await;
            log::debug!("ANDROID_VR: {:?}", r.as_ref().map(|_| "ok").map_err(|e| e.to_string()));
            let _ = tx.send(r).await;
        });
    }

    {
        let c = client.clone();
        let vid = video_id.to_string();
        let tx = tx.clone();
        let body = serde_json::json!({
            "context": { "client": {
                "clientName": "MWEB",
                "clientVersion": "2.20241126.01.00",
                "hl": "en", "gl": "US"
            }},
            "videoId": vid
        });
        tokio::spawn(async move {
            let r = innertube_request(&c, "2", "2.20241126.01.00",
                "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1,gzip(gfe)",
                false, body).await;
            log::debug!("MWEB: {:?}", r.as_ref().map(|_| "ok").map_err(|e| e.to_string()));
            let _ = tx.send(r).await;
        });
    }

    {
        let c = client.clone();
        let vid = video_id.to_string();
        let tx = tx.clone();
        let body = serde_json::json!({
            "context": {
                "client": {
                    "clientName": "WEB_EMBEDDED_PLAYER",
                    "clientVersion": "2.20241126.01.00",
                    "hl": "en", "gl": "US"
                },
                "thirdParty": { "embedUrl": "https://www.youtube.com/" }
            },
            "videoId": vid
        });
        tokio::spawn(async move {
            let r = innertube_request(&c, "56", "2.20241126.01.00",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                true, body).await;
            log::debug!("WEB_EMBEDDED: {:?}", r.as_ref().map(|_| "ok").map_err(|e| e.to_string()));
            let _ = tx.send(r).await;
        });
    }

    {
        let c = client.clone();
        let vid = video_id.to_string();
        let tx = tx.clone();
        let body = serde_json::json!({
            "context": { "client": {
                "clientName": "TVHTML5",
                "clientVersion": "7.20241126.17.00",
                "clientFormFactor": "LARGE_FORM_FACTOR",
                "hl": "en", "gl": "US"
            }},
            "videoId": vid
        });
        tokio::spawn(async move {
            let r = innertube_request(&c, "7", "7.20241126.17.00",
                "Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.5) AppleWebKit/538.1 (KHTML, like Gecko) Version/6.5 TV Safari/538.1",
                false, body).await;
            log::debug!("TVHTML5: {:?}", r.as_ref().map(|_| "ok").map_err(|e| e.to_string()));
            let _ = tx.send(r).await;
        });
    }

    {
        let c = client.clone();
        let vid = video_id.to_string();
        let tx = tx.clone();
        let body = serde_json::json!({
            "context": { "client": {
                "clientName": "ANDROID_MUSIC",
                "clientVersion": "7.27.52",
                "androidSdkVersion": 30,
                "hl": "en", "gl": "US"
            }},
            "videoId": vid
        });
        tokio::spawn(async move {
            let r = innertube_request(&c, "21", "7.27.52",
                "com.google.android.apps.youtube.music/7.27.52 (Linux; U; Android 11) gzip",
                false, body).await;
            log::debug!("ANDROID_MUSIC: {:?}", r.as_ref().map(|_| "ok").map_err(|e| e.to_string()));
            let _ = tx.send(r).await;
        });
    }

    drop(tx);

    let mut webm_fallback: Option<String> = None;

    while let Some(result) = rx.recv().await {
        if let Ok(url) = result {
            let is_webm = url.contains("mime=audio%2Fwebm")
                || url.contains("mime=audio/webm");
            if is_webm {
                webm_fallback.get_or_insert(url);
            } else {
                log::info!("InnerTube got m4a URL for {video_id}");
                return Ok(url);
            }
        }
    }

    if webm_fallback.is_some() {
        log::warn!(
            "InnerTube: only WebM/Opus URLs available for {video_id} — \
             no Opus codec; falling back to yt-dlp for m4a"
        );
    }

    Err(WaveError::YtDlp(
        "InnerTube: all clients returned WebM-only or failed — falling back to yt-dlp".into(),
    ))
}

pub async fn resolve_stream_url_piped(video_id: &str) -> WaveResult<String> {
    const INSTANCES: &[&str] = &[
        "https://pipedapi.kavin.rocks",
        "https://api.piped.projectsegfau.lt",
        "https://piped-api.garudalinux.org",
    ];

    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| WaveError::Network(e.to_string()))?;

    let (tx, mut rx) =
        tokio::sync::mpsc::channel::<WaveResult<String>>(INSTANCES.len());

    for &instance in INSTANCES {
        let c = client.clone();
        let vid = video_id.to_string();
        let base = instance.to_string();
        let tx = tx.clone();
        tokio::spawn(async move {
            let result: WaveResult<String> = async {
                let api_url = format!("{}/streams/{}", base, vid);
                let resp = c
                    .get(&api_url)
                    .header(
                        "User-Agent",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) \
                         AppleWebKit/537.36 (KHTML, like Gecko) \
                         Chrome/120.0.0.0 Safari/537.36",
                    )
                    .send()
                    .await
                    .map_err(|e| WaveError::Network(e.to_string()))?;

                if !resp.status().is_success() {
                    return Err(WaveError::YtDlp(format!(
                        "Piped {base}: HTTP {}",
                        resp.status()
                    )));
                }

                let json: serde_json::Value = resp
                    .json()
                    .await
                    .map_err(|e| WaveError::Network(e.to_string()))?;

                let audio_url = json["audioStreams"]
                    .as_array()
                    .and_then(|streams| {
                        streams
                            .iter()
                            .filter(|s| {
                                let fmt = s["format"].as_str().unwrap_or("").to_ascii_uppercase();
                                fmt == "M4A" || fmt.contains("MP4")
                            })
                            .max_by_key(|s| s["bitrate"].as_u64().unwrap_or(0))
                            .and_then(|s| s["url"].as_str().map(str::to_string))
                    })
                    .ok_or_else(|| {
                        WaveError::YtDlp(format!(
                            "Piped {base}: no M4A stream in response for {vid}"
                        ))
                    })?;

                log::info!("Piped {base}: resolved m4a URL for {vid}");
                Ok(audio_url)
            }
            .await;

            let _ = tx.send(result).await;
        });
    }
    drop(tx);

    let mut errors = Vec::new();
    while let Some(result) = rx.recv().await {
        match result {
            Ok(url) => return Ok(url),
            Err(e) => {
                log::debug!("Piped instance failed: {e}");
                errors.push(e.to_string());
            }
        }
    }

    Err(WaveError::YtDlp(format!(
        "All Piped instances failed for {video_id}: {}",
        errors.join("; ")
    )))
}

pub fn resolve_stream_url(video_id: &str) -> WaveResult<String> {
    let url = format!("https://www.youtube.com/watch?v={video_id}");
    let binary = find_ytdlp_binary()?;

    let mut cmd = std::process::Command::new(&binary);
    cmd.args([
            "--no-playlist",
            "--get-url",
            "-f", "140/bestaudio[ext=m4a]/bestaudio[acodec=mp4a.40.2]",
            "--no-warnings",
            "--no-check-certificates",
            &url,
        ])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn()
        .map_err(|e| WaveError::YtDlp(format!("Failed to launch yt-dlp: {e}")))?;

    let deadline =
        std::time::Instant::now() + std::time::Duration::from_secs(YTDLP_TIMEOUT_SECS);
    loop {
        match child.try_wait().map_err(|e| WaveError::YtDlp(e.to_string()))? {
            Some(_) => break,
            None => {
                if std::time::Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(WaveError::YtDlp(format!(
                        "yt-dlp timed out after {YTDLP_TIMEOUT_SECS}s"
                    )));
                }
                std::thread::sleep(std::time::Duration::from_millis(200));
            }
        }
    }

    use std::io::Read;
    let mut stdout_str = String::new();
    let mut stderr_str = String::new();
    if let Some(mut out) = child.stdout.take() {
        let _ = out.read_to_string(&mut stdout_str);
    }
    if let Some(mut err) = child.stderr.take() {
        let _ = err.read_to_string(&mut stderr_str);
    }

    let trimmed = stdout_str.trim();
    if trimmed.is_empty() {
        return Err(WaveError::YtDlp(format!(
            "yt-dlp returned no URL. stderr: {}",
            stderr_str.trim()
        )));
    }

    Ok(trimmed.lines().next().unwrap_or(trimmed).trim().to_string())
}

pub fn find_ytdlp_binary() -> WaveResult<PathBuf> {
    #[cfg(target_os = "windows")]
    let candidates: &[&str] = &[
        "yt-dlp-x86_64-pc-windows-msvc.exe",
        "yt-dlp.exe",
    ];
    #[cfg(target_os = "macos")]
    let candidates: &[&str] = if cfg!(target_arch = "aarch64") {
        &["yt-dlp-aarch64-apple-darwin", "yt-dlp"]
    } else {
        &["yt-dlp-x86_64-apple-darwin", "yt-dlp"]
    };
    #[cfg(target_os = "linux")]
    let candidates: &[&str] = &["yt-dlp-x86_64-unknown-linux-gnu", "yt-dlp"];

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            for name in candidates {
                let p = dir.join(name);
                if p.exists() {
                    log::debug!("yt-dlp found next to exe: {}", p.display());
                    return Ok(p);
                }
            }
            let res = dir.join("resources");
            for name in candidates {
                let p = res.join(name);
                if p.exists() {
                    log::debug!("yt-dlp found in resources/: {}", p.display());
                    return Ok(p);
                }
            }
        }
    }

    let mut dir = std::env::current_dir().unwrap_or_default();
    for _ in 0..8 {
        for name in candidates {
            let c1 = dir.join("src-tauri").join("binaries").join(name);
            if c1.exists() { return Ok(c1); }
            let c2 = dir.join("binaries").join(name);
            if c2.exists() { return Ok(c2); }
        }
        if !dir.pop() { break; }
    }

    Err(WaveError::YtDlp(format!(
        "yt-dlp binary not found. \
         Resolvers: InnerTube and Piped already tried. \
         For offline fallback place yt-dlp{} next to wave.exe",
        if cfg!(target_os = "windows") { ".exe" } else { "" }
    )))
}
