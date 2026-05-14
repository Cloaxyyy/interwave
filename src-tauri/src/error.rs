use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum WaveError {
    #[error("Database error: {0}")]
    Database(String),

    #[error("Audio error: {0}")]
    Audio(String),

    #[error("yt-dlp error: {0}")]
    YtDlp(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<rusqlite::Error> for WaveError {
    fn from(e: rusqlite::Error) -> Self {
        WaveError::Database(e.to_string())
    }
}

impl From<r2d2::Error> for WaveError {
    fn from(e: r2d2::Error) -> Self {
        WaveError::Database(e.to_string())
    }
}

impl From<reqwest::Error> for WaveError {
    fn from(e: reqwest::Error) -> Self {
        WaveError::Network(e.to_string())
    }
}

pub type WaveResult<T> = Result<T, WaveError>;
