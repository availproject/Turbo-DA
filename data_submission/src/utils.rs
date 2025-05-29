use crate::config::AppConfig;
use actix_web::HttpRequest;
use rand::Rng;
use uuid::Uuid;
/// Maps a user ID to a thread number based on the app config
///
/// # Arguments
/// * `config` - Application configuration containing number of threads
pub fn map_user_id_to_thread(config: &AppConfig) -> i32 {
    rand::thread_rng().gen_range(0..config.number_of_threads)
}

/// Retrieves user ID from HTTP request headers
///
/// # Arguments
/// * `http_request` - HTTP request to extract user ID from
pub fn retrieve_app_id(http_request: &HttpRequest) -> Option<Uuid> {
    let headers = http_request.headers();

    for (name, value) in headers.iter() {
        if name == "app_id" {
            if let Ok(app_id) = value.to_str() {
                return Uuid::parse_str(app_id).ok();
            }
        }
    }
    None
}
