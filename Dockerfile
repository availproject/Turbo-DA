#############################################################
## Dev ##
#############################################################

FROM --platform=linux/x86_64 ghcr.io/foundry-rs/foundry:master AS foundry-builder
COPY contracts /contracts
WORKDIR /contracts
RUN forge build

FROM docker.io/library/rust:1.82.0-bookworm AS base

FROM docker.io/library/debian:bookworm-slim AS runtime
RUN apt update && apt install -y libssl-dev libpq-dev ca-certificates

FROM base AS chef
RUN cargo install --locked cargo-chef
RUN apt update && apt install -y cmake 

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS cacher
COPY --from=planner /recipe.json recipe.json
RUN cargo chef cook --recipe-path recipe.json

FROM base AS builder
COPY . .
COPY --from=cacher /target target
COPY --from=cacher /usr/local/cargo /usr/local/cargo
COPY --from=foundry-builder /contracts/out ./contracts/out

FROM builder AS funds_monitor-builder
RUN cargo build --bin funds_monitor

FROM runtime AS funds_monitor
COPY --from=funds_monitor-builder /target/debug/funds_monitor /
COPY ./funds_monitor/.env /
ENTRYPOINT ["/funds_monitor"]

FROM builder AS fallback_monitor-builder
RUN cargo build --bin fallback_monitor

FROM runtime AS fallback_monitor
COPY --from=fallback_monitor-builder /target/debug/fallback_monitor /
COPY ./fallback_monitor/.env /
ENTRYPOINT ["/fallback_monitor"]

FROM builder AS turbo-da-core-builder
RUN cargo build --features permissioned --bin turbo-da-core

FROM runtime AS turbo-da-core
COPY --from=turbo-da-core-builder /target/debug/turbo-da-core /
COPY ./turbo-da-core/.env /
ENTRYPOINT ["/turbo-da-core"]
