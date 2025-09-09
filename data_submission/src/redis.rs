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

    /// Delete keys where their values start with the given pattern
    /// Returns the list of deleted keys
    pub fn delete_keys_by_value_prefix(&self, value_prefix: &str) -> Result<Vec<String>, String> {
        let mut conn = match self.redis_pool.get() {
            Ok(conn) => conn,
            Err(e) => return Err(e.to_string()),
        };

        let mut deleted_keys = Vec::new();
        let mut cursor = 0;

        loop {
            // Use SCAN to iterate through all keys
            let (new_cursor, keys): (u64, Vec<String>) =
                conn.scan(cursor).map_err(|e| e.to_string())?;

            for key in keys {
                // Get the value for each key
                match conn.get::<String, String>(key.clone()) {
                    Ok(value) => {
                        // Check if the value starts with our prefix
                        if value.starts_with(value_prefix) {
                            // Delete the key
                            let _: () = conn.del(&key).map_err(|e| e.to_string())?;
                            deleted_keys.push(key);
                        }
                    }
                    Err(_) => {
                        // Key might not exist or be of wrong type, skip
                        continue;
                    }
                }
            }

            cursor = new_cursor;
            if cursor == 0 {
                break;
            }
        }

        Ok(deleted_keys)
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
