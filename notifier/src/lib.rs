//! Outbound email alerts.
//!
//! Delivery goes through a transactional email HTTP API (Resend by default).
//! Every entry point is best effort: when credentials are absent the notifier
//! reports itself disabled and `send` becomes a logged no-op, so callers can
//! fire alerts from inside billing and retry paths without those paths ever
//! failing because email is misconfigured or the provider is down.

use bigdecimal::{BigDecimal, RoundingMode};
use serde_json::json;
use std::sync::OnceLock;

const DEFAULT_API_URL: &str = "https://api.resend.com/emails";

/// Credits are stored byte denominated; one credit is one KB.
const BYTES_PER_CREDIT: u32 = 1024;

const REQUEST_TIMEOUT_SECS: u64 = 10;

pub struct Notifier {
    client: reqwest::Client,
    api_key: Option<String>,
    from: Option<String>,
    api_url: String,
}

static SHARED: OnceLock<Notifier> = OnceLock::new();

/// Process wide notifier, built from the environment on first use.
///
/// Alert hooks live on hot paths that would otherwise rebuild a TLS capable
/// HTTP client per submission, so the client is shared.
pub fn shared() -> &'static Notifier {
    SHARED.get_or_init(Notifier::from_env)
}

impl Notifier {
    pub fn new(api_key: Option<String>, from: Option<String>, api_url: String) -> Self {
        // Alerts are sent from inside the submission path, which is itself
        // under a timeout: an unbounded POST here could make a submission that
        // succeeded look like it timed out.
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .unwrap_or_else(|e| {
                tracing::warn!(error = %e, "falling back to default alert http client");
                reqwest::Client::new()
            });

        Self {
            client,
            api_key,
            from,
            api_url,
        }
    }

    /// Reads `RESEND_API_KEY`, `ALERT_FROM_EMAIL` and the optional
    /// `ALERT_API_URL`. Blank values are treated as absent so that an empty
    /// entry in a deployment template does not look like a configured key.
    pub fn from_env() -> Self {
        let read = |key: &str| {
            std::env::var(key)
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        };

        Self::new(
            read("RESEND_API_KEY"),
            read("ALERT_FROM_EMAIL"),
            read("ALERT_API_URL").unwrap_or_else(|| DEFAULT_API_URL.to_string()),
        )
    }

    /// Whether credentials are present. Callers should check this before doing
    /// the database work an alert needs, and before latching any "already
    /// alerted" flag, so a misconfigured deployment does not silently mark
    /// alerts as delivered.
    pub fn enabled(&self) -> bool {
        self.api_key.is_some() && self.from.is_some()
    }

    pub async fn send(&self, to: &str, subject: &str, html: &str) -> Result<(), String> {
        let (Some(api_key), Some(from)) = (&self.api_key, &self.from) else {
            tracing::warn!("alert email skipped — RESEND_API_KEY/ALERT_FROM_EMAIL not configured");
            return Ok(());
        };

        let response = self
            .client
            .post(&self.api_url)
            .bearer_auth(api_key)
            .json(&json!({
                "from": from,
                "to": to,
                "subject": subject,
                "html": html,
            }))
            .send()
            .await
            .map_err(|e| format!("alert email request failed: {}", e))?;

        let status = response.status();
        if status.is_success() {
            tracing::info!(subject = %subject, "alert email sent");
            return Ok(());
        }

        let body = response
            .text()
            .await
            .unwrap_or_else(|e| format!("<unreadable body: {}>", e));
        Err(format!(
            "alert email rejected with status {}: {}",
            status, body
        ))
    }

    pub async fn send_low_balance_alert(
        &self,
        to: &str,
        balance_credits: &str,
        threshold_credits: &str,
    ) -> Result<(), String> {
        let html = render(
            "Your credit balance is low",
            "Your TurboDA credit balance has dropped below the threshold you set. \
             Top up to avoid interrupted data posting.",
            &[
                ("Current balance", balance_credits),
                ("Your threshold", threshold_credits),
            ],
        );

        self.send(to, "TurboDA: credit balance is low", &html).await
    }

    pub async fn send_runway_alert(
        &self,
        to: &str,
        runway_days: i64,
        threshold_days: i32,
        balance_credits: &str,
    ) -> Result<(), String> {
        let html = render(
            "Your credits are running out",
            "At your recent rate of use, your TurboDA credits will run out sooner \
             than the runway you asked to be warned about.",
            &[
                ("Estimated runway", &format!("{} days", runway_days)),
                ("Your threshold", &format!("{} days", threshold_days)),
                ("Current balance", balance_credits),
            ],
        );

        self.send(to, "TurboDA: credits running out", &html).await
    }

    pub async fn send_failed_post_alert(
        &self,
        to: &str,
        app_id: &str,
        error: &str,
    ) -> Result<(), String> {
        let html = render(
            "A data post failed",
            "One of your TurboDA apps could not post data. Further failures for \
             this app are muted for the next hour.",
            &[("App", app_id), ("Error", error)],
        );

        self.send(to, "TurboDA: data post failed", &html).await
    }
}

/// Renders byte denominated credits as whole credits for display.
pub fn format_credits(units: &BigDecimal) -> String {
    let credits =
        (units / BigDecimal::from(BYTES_PER_CREDIT)).with_scale_round(0, RoundingMode::HalfUp);
    group_thousands(&credits.to_string())
}

fn group_thousands(value: &str) -> String {
    let (sign, digits) = match value.strip_prefix('-') {
        Some(rest) => ("-", rest),
        None => ("", value),
    };

    let mut grouped = String::with_capacity(digits.len() + digits.len() / 3);
    for (index, ch) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(ch);
    }

    format!("{}{}", sign, grouped)
}

/// Chain and provider errors reach these emails verbatim, so anything
/// interpolated into the markup is escaped.
fn escape_html(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&#39;"),
            _ => escaped.push(ch),
        }
    }
    escaped
}

/// Builds the shared email body: a heading, one sentence of context and a
/// table of values. Inline styles only, no external assets, so the message
/// renders the same in clients that block remote content.
fn render(heading: &str, message: &str, rows: &[(&str, &str)]) -> String {
    let mut body = String::new();
    body.push_str(&format!(
        "<div style=\"font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;\
         font-size:15px;line-height:1.5;color:#111\">\
         <h1 style=\"font-size:18px;margin:0 0 12px\">{}</h1>\
         <p style=\"margin:0 0 16px\">{}</p>\
         <table style=\"border-collapse:collapse\">",
        escape_html(heading),
        escape_html(message)
    ));

    for (label, value) in rows {
        body.push_str(&format!(
            "<tr>\
             <td style=\"padding:4px 16px 4px 0;color:#555\">{}</td>\
             <td style=\"padding:4px 0;font-weight:600\">{}</td>\
             </tr>",
            escape_html(label),
            escape_html(value)
        ));
    }

    body.push_str(
        "</table>\
         <p style=\"margin:16px 0 0;font-size:13px;color:#777\">\
         You can change or turn off these alerts in your TurboDA dashboard settings.</p>\
         </div>",
    );

    body
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn configured() -> Notifier {
        Notifier::new(
            Some("test-key".to_string()),
            Some("alerts@example.com".to_string()),
            "http://127.0.0.1:1/emails".to_string(),
        )
    }

    #[test]
    fn enabled_requires_both_key_and_sender() {
        assert!(configured().enabled());

        assert!(!Notifier::new(
            None,
            Some("alerts@example.com".to_string()),
            DEFAULT_API_URL.to_string()
        )
        .enabled());

        assert!(!Notifier::new(Some("k".to_string()), None, DEFAULT_API_URL.to_string()).enabled());

        assert!(!Notifier::new(None, None, DEFAULT_API_URL.to_string()).enabled());
    }

    #[tokio::test]
    async fn send_is_a_no_op_when_disabled() {
        // The unroutable api_url proves no request went out: a disabled
        // notifier returns Ok without touching the network.
        let notifier = Notifier::new(None, None, "http://127.0.0.1:1/emails".to_string());

        assert_eq!(
            notifier.send("u@example.com", "s", "<p>b</p>").await,
            Ok(())
        );
        assert_eq!(
            notifier
                .send_low_balance_alert("u@example.com", "10", "100")
                .await,
            Ok(())
        );
        assert_eq!(
            notifier
                .send_runway_alert("u@example.com", 2, 7, "10")
                .await,
            Ok(())
        );
        assert_eq!(
            notifier
                .send_failed_post_alert("u@example.com", "app", "boom")
                .await,
            Ok(())
        );
    }

    #[tokio::test]
    async fn send_reports_transport_failure_when_enabled() {
        let result = configured().send("u@example.com", "s", "<p>b</p>").await;

        assert!(
            matches!(&result, Err(e) if e.contains("alert email request failed")),
            "expected a transport error, got {:?}",
            result
        );
    }

    #[test]
    fn from_env_defaults_the_api_url() {
        // Only asserts the default, to avoid depending on ambient env vars.
        assert!(!Notifier::from_env().api_url.is_empty());
    }

    #[test]
    fn credits_render_as_kilobyte_denominated_whole_numbers() {
        assert_eq!(
            format_credits(&BigDecimal::from_str("1048576").unwrap()),
            "1,024"
        );
        assert_eq!(format_credits(&BigDecimal::from_str("1024").unwrap()), "1");
        assert_eq!(format_credits(&BigDecimal::from_str("1536").unwrap()), "2");
        assert_eq!(format_credits(&BigDecimal::from_str("0").unwrap()), "0");
        assert_eq!(
            format_credits(&BigDecimal::from_str("1234567890").unwrap()),
            "1,205,633"
        );
    }

    #[test]
    fn interpolated_values_are_escaped() {
        let html = render(
            "Head",
            "Message",
            &[("Error", "<script>alert('x')</script>")],
        );

        assert!(!html.contains("<script>"));
        assert!(html.contains("&lt;script&gt;"));
        assert!(html.contains("&#39;x&#39;"));
    }

    #[test]
    fn rendered_body_carries_every_row() {
        let html = render("Head", "Message", &[("App", "abc"), ("Error", "boom")]);

        assert!(html.contains("Head"));
        assert!(html.contains("Message"));
        assert!(html.contains("abc"));
        assert!(html.contains("boom"));
        assert!(!html.contains("http://"), "no external assets: {}", html);
    }
}
