use r2d2;
use redis::{self, Commands};

#[derive(Clone)]
pub struct Redis {
    pub(crate) redis_pool: r2d2::Pool<redis::Client>,
}

impl Redis {
    pub fn new(redis_url: &str) -> Redis {
        let client = redis::Client::open(redis_url);
        match client {
            Ok(client) => {
                let pool = r2d2::Pool::builder().build(client).unwrap();
                Redis { redis_pool: pool }
            }
            Err(e) => {
                tracing::error!(error = %e, "failed to connect to Redis");
                panic!("Failed to connect to Redis: {}", e)
            }
        }
    }

    pub fn set(&self, key: &str, value: &str) -> Result<String, String> {
        let mut conn = match self.redis_pool.get() {
            Ok(conn) => conn,
            Err(e) => return Err(e.to_string()),
        };
        Ok(conn.set(key, value).map_err(|e| e.to_string())?)
    }

    /// Sets a key that expires on its own after `ttl_secs` seconds.
    pub fn set_ex(&self, key: &str, value: &str, ttl_secs: u64) -> Result<String, String> {
        let mut conn = match self.redis_pool.get() {
            Ok(conn) => conn,
            Err(e) => return Err(e.to_string()),
        };
        conn.set_ex(key, value, ttl_secs).map_err(|e| e.to_string())
    }

    pub fn get(&self, key: &str) -> Result<String, String> {
        let mut conn = match self.redis_pool.get() {
            Ok(conn) => conn,
            Err(e) => return Err(e.to_string()),
        };
        match conn.get(key) {
            Ok(value) => Ok(value),
            Err(e) => Err(e.to_string()),
        }
    }
}
