use fmt::Layer;
use opentelemetry::{
    global,
    trace::{SamplingDecision, SamplingResult, TraceContextExt},
    KeyValue, Value,
};
use opentelemetry_otlp::{new_exporter, new_pipeline, TonicExporterBuilder, WithExportConfig};
use opentelemetry_sdk::{
    runtime::Tokio,
    trace::{BatchConfigBuilder, Config, ShouldSample},
    Resource,
};
use std::{env, io::stdout, time::Duration};
use tracing::Level;
use tracing_subscriber::{
    fmt::{
        self,
        format::{Format, Json, JsonFields},
        writer::MakeWriterExt,
    },
    prelude::*,
    EnvFilter, Registry,
};

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
    Resource::new([KeyValue::new("service.name", service_name)])
}

fn otel_exporter() -> TonicExporterBuilder {
    let endpoint = env::var("OTLP_RECEIVER_URL").unwrap_or("http://otc:4317".to_string());
    new_exporter().tonic().with_endpoint(&endpoint)
}

pub fn init_tracer<T: Into<Value>>(service_name: T) {
    let stdout_layer = boolean_env("ENABLE_STDOUT_LOGGING")
        .then(|| Layer::default().with_writer(stdout.with_max_level(log_level_env("LOG_LEVEL"))));
    let env_filter = EnvFilter::from_default_env().add_directive(log_level_env("LOG_LEVEL").into());
    let fmt_layer: Layer<Registry, JsonFields, Format<Json>> = fmt::Layer::default().json();
    let otel_layer = if boolean_env("ENABLE_OTEL_TRACING") {
        let batch_config = BatchConfigBuilder::default()
            .with_max_queue_size(1000000)
            .with_max_export_batch_size(256)
            .with_scheduled_delay(Duration::from_millis(2500))
            .build();
        let config = Config::default()
            .with_resource(resource(service_name))
            .with_sampler(TurboDASampler);
        let pipeline = new_pipeline()
            .tracing()
            .with_exporter(otel_exporter())
            .with_trace_config(config)
            .with_batch_config(batch_config);
        let tracer = pipeline.install_batch(Tokio).unwrap();
        Some(tracing_opentelemetry::layer().with_tracer(tracer))
    } else {
        None
    };

    let subscriber = Registry::default()
        .with(fmt_layer)
        .with(otel_layer)
        .with(env_filter)
        .with(stdout_layer);
    tracing::subscriber::set_global_default(subscriber).expect("Сould not set default for tracer");
}

pub fn init_meter<T: Into<Value>>(service_name: T) {
    if boolean_env("ENABLE_OTEL_METRICS") {
        let meter_provider = new_pipeline()
            .metrics(Tokio)
            .with_exporter(otel_exporter())
            .with_resource(resource(service_name))
            .build()
            .unwrap();
        global::set_meter_provider(meter_provider);
    }
}

pub fn boolean_env(env_name: &'static str) -> bool {
    env::var(env_name)
        .unwrap_or("true".to_string())
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
    let counter = meter.u64_counter(counter_name).init();
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
