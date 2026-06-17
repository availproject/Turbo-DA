FROM docker.io/library/rust:1.91-bookworm AS foundry-builder
WORKDIR /build
RUN apt-get update && apt-get install -y git curl cmake

FROM docker.io/library/debian:bookworm-slim AS runtime
RUN apt update && apt install -y libssl-dev libpq-dev ca-certificates

FROM foundry-builder AS chef
RUN cargo install --locked cargo-chef

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS cacher
COPY --from=planner /build/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

FROM chef AS builder
COPY --from=cacher /build/target target
COPY --from=cacher /usr/local/cargo /usr/local/cargo
COPY . .

FROM builder AS funds_monitor-builder
RUN cargo build --bin funds_monitor --release

FROM runtime AS funds_monitor
COPY --from=funds_monitor-builder /build/target/release/funds_monitor /
ENTRYPOINT ["/funds_monitor"]

FROM builder AS fallback_monitor-builder
RUN cargo build --bin fallback_monitor --release

FROM runtime AS fallback_monitor
COPY --from=fallback_monitor-builder /build/target/release/fallback_monitor /
ENTRYPOINT ["/fallback_monitor"]

FROM builder AS turbo-da-core-builder
RUN cargo build --features permissioned --bin turbo-da-core --release

FROM runtime AS turbo-da-core
COPY --from=turbo-da-core-builder /build/target/release/turbo-da-core /
ENTRYPOINT ["/turbo-da-core"]

FROM builder AS data_submission-builder
RUN cargo build --bin data_submission --release

FROM runtime AS data_submission
COPY --from=data_submission-builder /build/target/release/data_submission /
ENTRYPOINT ["/data_submission"]