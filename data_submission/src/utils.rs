use crate::config::AppConfig;
use rand::Rng;
/// Maps a user ID to a thread number based on the app config
///
/// # Arguments
/// * `config` - Application configuration containing number of threads
pub fn map_user_id_to_thread(config: &AppConfig) -> i32 {
    rand::thread_rng().gen_range(0..config.number_of_threads)
}
