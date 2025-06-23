use tracing::{debug, error, info, trace, warn};

pub fn warn(message: &String) {
    warn!(
        "{}",
        serde_json::json!({
            "message": message,
            "level": "warn"
        })
    );
}

pub fn warn_json(json: serde_json::Value) {
    warn!("{}", json);
}

pub fn error(message: &String) {
    error!(
        "{}",
        serde_json::json!({
            "message": message,
            "level": "error"
        })
    );
}

pub fn error_json(json: serde_json::Value) {
    error!("{}", json);
}

pub fn info(message: &String) {
    info!(
        "{}",
        serde_json::json!({
            "message": message,
            "level": "info"
        })
    );
}

pub fn info_json(json: serde_json::Value) {
    info!("{}", json);
}

pub fn debug(message: &String) {
    debug!(
        "{}",
        serde_json::json!({
            "message": message,
            "level": "debug"
        })
    );
}

pub fn debug_json(json: serde_json::Value) {
    debug!("{}", json);
}

pub fn trace(message: &String) {
    trace!(
        "{}",
        serde_json::json!({
            "message": message,
            "level": "trace"
        })
    );
}

pub fn trace_json(json: serde_json::Value) {
    trace!("{}", json);
}
