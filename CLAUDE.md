# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TurboDA posts data to Avail DA chain on users' behalf. Users buy credits via multi-token deposits on Ethereum, then submit data at guaranteed rates. The system consists of Rust backend services, a Next.js dashboard, and Solidity smart contracts.

## Build and Development Commands

### Rust Backend
```bash
cargo build --release              # Build all workspace members
cargo test                         # Run all tests
cargo test test_name               # Run specific test
cargo fmt --all                    # Format code
cargo clippy --all-targets --all-features  # Lint
```

### Database Migrations
```bash
cd db && ./migration.sh ./config.json      # Setup database
diesel migration run --database-url $DATABASE_URL  # Run migrations manually
```

### Frontend (dashboard/)
```bash
pnpm i                  # Install dependencies
pnpm run dev           # Development server (port 3000)
pnpm run build         # Production build
pnpm run lint          # Lint
```

### Smart Contracts (contracts/)
```bash
forge build            # Compile
forge test             # Run tests
forge test --match-test testName  # Run specific test
forge fmt              # Format Solidity
```

## Architecture

```
├── turbo-da-core/        # Main REST API (Actix-web, port 8080) - user/app management, fund requests
├── data_submission/      # Worker service - submits data to Avail chain via workload scheduler
├── db/                   # Shared Diesel ORM crate - models, controllers, schema
├── funds_monitor/        # EVM blockchain indexer - monitors deposits/withdrawals
├── fallback_monitor/     # Retry service for failed Avail transactions
├── observability/        # OpenTelemetry tracing utilities
├── avail/                # Avail chain SDK wrapper
├── enigma/               # Encryption service client (threshold decryption)
├── dashboard/            # Next.js 15 + React 19 frontend
└── contracts/            # Solidity + Foundry (TurboDAResolver.sol)
```

### Key Patterns

- **Authentication**: Clerk JWT for user endpoints, API keys (Keccak256 hashed) for data submission
- **Database**: Async Diesel with deadpool connection pooling
- **API Responses**: Structured JSON with `state`, `message`, `data` fields
- **Financial Calculations**: Always use `BigDecimal` (never `f64`)
- **Workspace Dependencies**: Check root `Cargo.toml` before adding new Rust dependencies

### Data Flow
1. Users authenticate via Clerk JWT → turbo-da-core
2. Data submission requests use API keys → data_submission service
3. Workload scheduler processes submissions → Avail chain
4. Failed transactions → fallback_monitor retries
5. EVM deposits → funds_monitor indexes and credits accounts

## Testing Requirements

Set `DATABASE_URL_TEST` environment variable before running Rust tests:
```bash
export DATABASE_URL_TEST=postgres://user:password@localhost:5432/postgres
cargo test
```

## Code Style

### Rust
- Import order: std → external crates → workspace → internal (`use crate::`)
- Error responses: `HttpResponse::Ok().json(json!({"state": "SUCCESS", "message": "...", "data": ...}))`
- Use `diesel_async::RunQueryDsl` for database operations
- Avoid `unwrap()` in production code without error context

### TypeScript (Dashboard)
- Use `@/` path aliases for all imports
- Import order: React/Next → external → @/ paths → relative
- Strict mode enabled - avoid `any`

### Solidity
- Version: `pragma solidity 0.8.28;`
- Use OpenZeppelin upgradeable contracts
- NatSpec documentation required