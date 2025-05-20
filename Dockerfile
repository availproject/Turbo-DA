FROM docker.io/library/rust:1.85.1-bookworm AS foundry-builder
WORKDIR /build
RUN apt-get update && apt-get install -y git curl cmake
COPY . .
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="/root/.foundry/bin:${PATH}"
RUN bash -c "source /root/.bashrc && foundryup"
WORKDIR ./contracts
RUN git init . && \
    git config --global user.email "docker@example.com" && \
    git config --global user.name "Docker Build"
RUN forge install -- --force
RUN forge build
WORKDIR /build

FROM docker.io/library/debian:bookworm-slim AS runtime
RUN apt update && apt install -y libssl-dev libpq-dev ca-certificates

FROM foundry-builder AS chef
RUN cargo install --locked cargo-chef

FROM chef AS planner
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS cacher
COPY --from=planner /build/recipe.json recipe.json
RUN cargo chef cook --recipe-path recipe.json

FROM chef AS builder
COPY --from=cacher /build/target target
COPY --from=cacher /usr/local/cargo /usr/local/cargo

FROM builder AS funds_monitor-builder
RUN cargo build --bin funds_monitor

FROM runtime AS funds_monitor
COPY --from=funds_monitor-builder /build/target/debug/funds_monitor /
ENTRYPOINT ["/funds_monitor"]

FROM builder AS fallback_monitor-builder
RUN cargo build --bin fallback_monitor

FROM runtime AS fallback_monitor
COPY --from=fallback_monitor-builder /build/target/debug/fallback_monitor /
ENTRYPOINT ["/fallback_monitor"]

FROM builder AS turbo-da-core-builder
RUN cargo build --features permissioned --bin turbo-da-core

FROM runtime AS turbo-da-core
COPY --from=turbo-da-core-builder /build/target/debug/turbo-da-core /
ENTRYPOINT ["/turbo-da-core"]

FROM builder AS data_submission-builder
RUN cargo build --bin data_submission

FROM runtime AS data_submission
COPY --from=data_submission-builder /build/target/debug/data_submission /
ENTRYPOINT ["/data_submission"]
