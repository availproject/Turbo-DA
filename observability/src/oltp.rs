use opentelemetry::{
    global,
    trace::{TraceContextExt, TracerProvider as _},
    KeyValue, Value,
};
use opentelemetry_otlp::{MetricExporter, Protocol, SpanExporter, WithExportConfig};
use opentelemetry_sdk::{
    metrics::SdkMeterProvider,
    trace::{
        BatchConfigBuilder, BatchSpanProcessor, SamplingDecision, SamplingResult,
        SdkTracerProvider, ShouldSample,
    },
    Resource,
};
use std::{env, time::Duration};
use tracing::Level;
use tracing_subscriber::{fmt, prelude::*, EnvFilter, Registry};
use url::Url;

#[derive(Debug, Clone, Copy)]
struct TurboDASampler;

impl ShouldSample for TurboDASampler {
    fn should_sample(
        &self,
        parent_context: Option<&opentelemetry::Context>,
        _: opentelemetry::trace::TraceId,
        _: &str,
        _: &opentelemetry::trace::SpanKind,
        _: &[KeyValue],
        _: &[opentelemetry::trace::Link],
    ) -> SamplingResult {
        SamplingResult {
            decision: SamplingDecision::RecordAndSample,
            attributes: Vec::new(),
            trace_state: match parent_context {
                Some(ctx) => ctx.span().span_context().trace_state().clone(),
                None => Default::default(),
            },
        }
    }
}

fn resource<T: Into<Value>>(service_name: T) -> Resource {
    Resource::builder_empty()
        .with_attributes([KeyValue::new("service.name", service_name)])
        .build()
}

fn otel_endpoint() -> String {
    env::var("OTLP_RECEIVER_URL").unwrap_or("http://otc:4318".to_string())
}

use tracing_appender::non_blocking::WorkerGuard;

pub fn init_tracer<T: Into<Value>>(service_name: T) -> WorkerGuard {
    let service_name = service_name.into();
    let (non_blocking, guard) = tracing_appender::non_blocking(std::io::stdout());

    let env_filter = EnvFilter::from_default_env().add_directive(log_level_env("LOG_LEVEL").into());

    if !cfg!(debug_assertions) {
        let fmt_layer = fmt::Layer::default()
            .json()
            .with_span_list(false)
            .with_writer(non_blocking);

        let subscriber = Registry::default().with(fmt_layer).with(env_filter);
        configure_subscriber(subscriber, service_name);
    } else {
        // Local environment - Compact printing
        let fmt_layer = fmt::Layer::default()
            .compact()
            .with_file(false)
            .with_line_number(false)
            .with_writer(non_blocking);

        let subscriber = Registry::default().with(fmt_layer).with(env_filter);
        configure_subscriber(subscriber, service_name);
    }

    guard
}

fn configure_subscriber<S>(subscriber: S, service_name: Value)
where
    S: tracing::Subscriber
        + Send
        + Sync
        + 'static
        + for<'a> tracing_subscriber::registry::LookupSpan<'a>,
{
    if boolean_env("ENABLE_OTEL_TRACING") {
        let batch_config = BatchConfigBuilder::default()
            .with_max_queue_size(1000000)
            .with_max_export_batch_size(256)
            .with_scheduled_delay(Duration::from_millis(2500))
            .build();
        let exporter = SpanExporter::builder()
            .with_http()
            .with_protocol(Protocol::HttpBinary)
            .with_endpoint(otel_endpoint())
            .build()
            .unwrap();
        let batch_processor = BatchSpanProcessor::builder(exporter)
            .with_batch_config(batch_config)
            .build();
        let tracer_provider = SdkTracerProvider::builder()
            .with_resource(resource(service_name.clone()))
            .with_sampler(TurboDASampler)
            .with_span_processor(batch_processor)
            .build();
        let tracer = tracer_provider.tracer("turbo_da");
        global::set_tracer_provider(tracer_provider);
        let otel_layer = tracing_opentelemetry::layer().with_tracer(tracer);

        let subscriber = subscriber.with(otel_layer);

        if boolean_env("ENABLE_LOKI_LOGGING") {
            let (layer, task) = tracing_loki::builder()
                .label("service_name", service_name.to_string())
                .expect("Failed to set service_name label")
                .build_url(
                    Url::parse(
                        &env::var("LOKI_URL").unwrap_or("http://localhost:3100".to_string()),
                    )
                    .expect("Failed to parse LOKI_URL"),
                )
                .expect("Failed to build Loki layer");

            tokio::spawn(task);
            let subscriber = subscriber.with(layer);
            tracing::subscriber::set_global_default(subscriber)
                .expect("Could not set default for tracer");
        } else {
            tracing::subscriber::set_global_default(subscriber)
                .expect("Could not set default for tracer");
        }
    } else if boolean_env("ENABLE_LOKI_LOGGING") {
        let (layer, task) = tracing_loki::builder()
            .label("service_name", service_name.to_string())
            .expect("Failed to set service_name label")
            .build_url(
                Url::parse(&env::var("LOKI_URL").unwrap_or("http://localhost:3100".to_string()))
                    .expect("Failed to parse LOKI_URL"),
            )
            .expect("Failed to build Loki layer");

        tokio::spawn(task);
        let subscriber = subscriber.with(layer);
        tracing::subscriber::set_global_default(subscriber)
            .expect("Could not set default for tracer");
    } else {
        tracing::subscriber::set_global_default(subscriber)
            .expect("Could not set default for tracer");
    }
}

pub fn init_meter<T: Into<Value>>(service_name: T) {
    if boolean_env("ENABLE_OTEL_METRICS") {
        let exporter = MetricExporter::builder()
            .with_http()
            .with_protocol(Protocol::HttpBinary)
            .with_endpoint(otel_endpoint())
            .build()
            .unwrap();
        let meter_provider = SdkMeterProvider::builder()
            .with_resource(resource(service_name))
            .with_periodic_exporter(exporter)
            .build();
        global::set_meter_provider(meter_provider);
    }
}

pub fn boolean_env(env_name: &'static str) -> bool {
    env::var(env_name)
        .unwrap_or("false".to_string())
        .parse()
        .unwrap_or_else(|_| panic!("{} must be a boolean", env_name))
}

pub fn log_level_env(env_name: &'static str) -> Level {
    env::var(env_name)
        .ok()
        .map(|s| s.to_uppercase())
        .and_then(|s| s.parse::<Level>().ok())
        .unwrap_or(Level::INFO)
}

fn log(counter_name: String, attributes: Option<&[KeyValue]>) {
    let meter = global::meter("turbo_da");
    let counter = meter.u64_counter(counter_name).build();
    counter.add(1, attributes.unwrap_or_default());
}

pub fn log_txn(submission_id: &str, thread_id: i32, reason: &str) {
    let attributes = [
        KeyValue::new("reason", Value::String(reason.to_string().into())),
        KeyValue::new("thread_id", Value::String(thread_id.to_string().into())),
        KeyValue::new(
            "submission_id",
            Value::String(submission_id.to_string().into()),
        ),
    ];
    let counter_name = if reason == "success" {
        "turbDA.success_txn"
    } else {
        "turboDA.failed_txn"
    };

    log(counter_name.into(), Some(&attributes))
}

pub fn log_retry_count(submission_id: &str, retry_count: usize) {
    let attributes = [
        KeyValue::new(
            "submission_id",
            Value::String(submission_id.to_string().into()),
        ),
        KeyValue::new("retry_count", Value::String(retry_count.to_string().into())),
    ];
    log("turboDA.fallback_retry_count".into(), Some(&attributes))
}

pub fn log_fallback_txn_error(submission_id: &str, reason: &str) {
    let attributes = [
        KeyValue::new(
            "submission_id",
            Value::String(submission_id.to_string().into()),
        ),
        KeyValue::new("reason", Value::String(reason.to_string().into())),
    ];
    log("turboDA.fallback_txn_error".into(), Some(&attributes))
}
