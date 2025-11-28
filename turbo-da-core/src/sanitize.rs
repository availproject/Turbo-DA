/// Secret sanitization utilities to prevent sensitive data from appearing in logs
use std::fmt;

/// Sanitizes a generic secret by showing only a prefix
///
/// # Examples
/// ```
/// use turbo_da_core::sanitize::sanitize_secret;
/// let api_key = "sk_live_1234567890abcdef";
/// assert_eq!(sanitize_secret(api_key, 8), "sk_live_***");
/// ```
pub fn sanitize_secret(value: &str, show_prefix: usize) -> String {
    if value.is_empty() {
        return "***".to_string();
    }
    if value.len() <= show_prefix {
        return "***".to_string();
    }
    format!("{}***", &value[..show_prefix])
}

/// Sanitizes an API key (shows first 8 characters)
pub fn sanitize_api_key(key: &str) -> String {
    sanitize_secret(key, 8)
}

/// Sanitizes a database URL by removing credentials
///
/// # Examples
/// ```
/// let url = "postgres://user:password@localhost:5432/db";
/// // Returns: "postgres://***@localhost:5432/db"
/// ```
pub fn sanitize_database_url(url: &str) -> String {
    if let Some(at_pos) = url.find('@') {
        if let Some(scheme_end) = url.find("://") {
            let scheme = &url[..scheme_end + 3];
            let host_and_rest = &url[at_pos..];
            return format!("{}***{}", scheme, host_and_rest);
        }
    }
    "***".to_string()
}

/// Sanitizes a Redis URL by removing credentials
pub fn sanitize_redis_url(url: &str) -> String {
    sanitize_database_url(url)
}

/// Wrapper type that sanitizes Debug output
///
/// # Examples
/// ```
/// use turbo_da_core::sanitize::Sanitized;
///
/// let api_key = "sk_live_1234567890abcdef";
/// let sanitized = Sanitized::api_key(api_key);
/// println!("{:?}", sanitized); // Prints: "sk_live_***"
/// ```
pub struct Sanitized {
    value: String,
}

impl Sanitized {
    pub fn api_key(value: &str) -> Self {
        Self {
            value: sanitize_api_key(value),
        }
    }

    pub fn database_url(value: &str) -> Self {
        Self {
            value: sanitize_database_url(value),
        }
    }

    pub fn secret(value: &str, show_prefix: usize) -> Self {
        Self {
            value: sanitize_secret(value, show_prefix),
        }
    }
}

impl fmt::Debug for Sanitized {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.value)
    }
}

impl fmt::Display for Sanitized {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_api_key() {
        assert_eq!(sanitize_api_key("sk_live_1234567890"), "sk_live_***");
        assert_eq!(sanitize_api_key("short"), "***");
        assert_eq!(sanitize_api_key(""), "***");
    }

    #[test]
    fn test_sanitize_database_url() {
        let url = "postgres://user:password@localhost:5432/db";
        assert_eq!(
            sanitize_database_url(url),
            "postgres://***@localhost:5432/db"
        );
    }

    #[test]
    fn test_sanitized_wrapper() {
        let api_key = "sk_live_1234567890abcdef";
        let sanitized = Sanitized::api_key(api_key);
        assert_eq!(format!("{:?}", sanitized), "sk_live_***");
        assert_eq!(format!("{}", sanitized), "sk_live_***");
    }
}
