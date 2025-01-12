FROM docker.io/library/rust:1.78.0-bookworm AS base

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

FROM builder AS service-builder
RUN cargo build

FROM runtime AS service
RUN apt update && apt install -y build-essential
COPY --from=service-builder /target/debug/ /
COPY --from=service-builder /public_key.pem /public_key.pem /
ENTRYPOINT ["/turbo_da_core"]