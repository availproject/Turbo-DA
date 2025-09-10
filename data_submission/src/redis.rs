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
            Err(e) => panic!("Failed to connect to Redis: {}", e),
        }
    }

    pub fn set(&self, key: &str, value: &str) -> Result<String, String> {
        let mut conn = match self.redis_pool.get() {
            Ok(conn) => conn,
            Err(e) => return Err(e.to_string()),
        };
        Ok(conn.set(key, value).map_err(|e| e.to_string())?)
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

    /// Delete a specific key
    pub fn delete(&self, key: &str) -> Result<(), String> {
        let mut conn = match self.redis_pool.get() {
            Ok(conn) => conn,
            Err(e) => return Err(e.to_string()),
        };
        let _: () = conn.del(key).map_err(|e| e.to_string())?;
        Ok(())
    }
}
