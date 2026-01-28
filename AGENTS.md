# AGENTS.md - TurboDA Codebase Guide

**Generated**: January 13, 2026  
**Commit**: `06246b3` (main)  
**Branch**: main

---

## OVERVIEW

TurboDA posts data to Avail DA chain on users' behalf. Users buy credits via multi-token deposits on Ethereum, then submit data at guaranteed rates. Rust backend + Next.js dashboard + Solidity contracts.

## STRUCTURE

```
├── turbo-da-core/        # Main API (Actix-web) - port 8080
├── data_submission/      # Data submission worker + workload_scheduler
├── db/                   # Diesel ORM models/controllers (shared crate)
├── funds_monitor/        # EVM chain indexer for deposits/withdrawals
├── fallback_monitor/     # Retry failed Avail transactions
├── observability/        # OpenTelemetry tracing utilities
├── avail/                # Avail chain SDK wrapper (avail-utils)
├── dashboard/            # Next.js 15 + React 19 (see dashboard/AGENTS.md)
└── contracts/            # Solidity + Foundry (TurboDAResolver.sol)
```

## WORKSPACE ARCHITECTURE

Hub-and-spoke dependency model:

- **db** → used by ALL services (models, controllers, schema)
- **turbo-da-core** → exposes logger, utils; used by monitors
- **observability** → used by ALL services (no deps)
- **avail-utils** → used by db, data_submission, fallback_monitor

---

## Build, Lint, and Test Commands

### Rust Backend Services

**Prerequisites**: Rust toolchain, PostgreSQL, Diesel CLI

```bash
# Build all workspace members
cargo build --release

# Run specific service (from service directory)
cd turbo-da-core
cargo run --release

# Run all tests
cargo test

# Run specific test
cargo test test_user_registration_success

# Run tests with logging
RUST_LOG=trace cargo test

# Format code
cargo fmt --all

# Lint
cargo clippy --all-targets --all-features

# Generate documentation
cargo doc --open
```

**Database Migrations**:

```bash
cd db
# Setup database (requires config.json)
./migration.sh ./config.json

# Run migrations manually
diesel migration run --database-url $DATABASE_URL
```

**Testing Requirements**:

- Set `DATABASE_URL_TEST` environment variable before running tests
- Tests automatically create/destroy temporary databases
- Example: `export DATABASE_URL_TEST=postgres://user:password@localhost:5432/postgres`

### Frontend Dashboard

**Prerequisites**: Node.js, pnpm

```bash
cd dashboard

# Install dependencies
pnpm i

# Development server (runs on port 3000)
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm run start

# Lint
pnpm run lint
```

### Smart Contracts

**Prerequisites**: Foundry

```bash
cd contracts

# Build contracts
forge build

# Run all tests
forge test

# Run specific test
forge test --match-test testDeposit

# Format Solidity code
forge fmt

# Gas snapshots
forge snapshot
```

---

## Code Style Guidelines

### Rust

#### Module Organization

```rust
// Order: public modules → use statements → types → functions
pub mod config;
pub mod controllers;
pub mod utils;

// Import order: std → external crates → workspace → internal
use std::collections::HashMap;

use actix_web::{HttpResponse, web};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use db::models::user_model::User;

use crate::logger::{error, info};
use crate::utils::get_connection;
```

#### Naming Conventions

- **Types**: `PascalCase` (e.g., `UserCreate`, `AppConfig`)
- **Functions**: `snake_case` (e.g., `get_user`, `register_new_user`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `OPERATOR_ROLE`)
- **Module files**: `snake_case.rs` (e.g., `user_model.rs`)

#### Function Signatures

```rust
/// Comprehensive documentation for public functions
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `user_id` - User identifier
///
/// # Returns
/// HttpResponse with user data or error
pub async fn get_user(
    pool: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    // Implementation
}
```

#### Error Handling

- Use `HttpResponse` builders with appropriate status codes
- Return structured JSON responses:

```rust
HttpResponse::Ok().json(json!({
    "state": "SUCCESS",
    "message": "Operation completed",
    "data": result
}))

HttpResponse::InternalServerError().json(json!({
    "state": "ERROR",
    "message": error_message
}))
```

#### Database Operations

```rust
use diesel_async::RunQueryDsl;

// Use async Diesel operations
let result = schema::users::table
    .filter(schema::users::id.eq(user_id))
    .select(User::as_select())
    .first(&mut conn)
    .await;
```

#### Types and Validation

```rust
use validator::Validate;
use bigdecimal::BigDecimal;
use uuid::Uuid;

#[derive(Deserialize, Serialize, Validate)]
pub struct RegisterUser {
    pub name: Option<String>,
    pub sumsub_timestamp: Option<chrono::NaiveDateTime>,
}

// Use BigDecimal for financial amounts
// Use Uuid for identifiers
// Use chrono for timestamps
```

#### Logging

```rust
// Use custom logger utilities
use crate::logger::{info, warn, error, debug_json};

info(&"Service started".to_string());
error(&format!("Failed to process: {}", error_msg));
debug_json(json!({"user_id": user_id, "status": "active"}));
```

### TypeScript/React (Dashboard)

#### Import Organization

```typescript
// Order: React/Next → External libraries → Internal (@/) → Relative
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

import { Card } from "@/components/ui/card";
import { useConfig } from "@/providers/ConfigProvider";
import { AppDetails } from "@/services/app/response";
import { formatDataBytes } from "@/lib/utils";

import "./styles.css";
```

#### Naming Conventions

- **Components**: `PascalCase` (e.g., `UserProfile`, `DashboardWrapper`)
- **Hooks**: `camelCase` starting with `use` (e.g., `useApiKeys`, `useTokenMap`)
- **Files**: `kebab-case.tsx` for components (e.g., `app-item.tsx`)
- **Types/Interfaces**: `PascalCase` (e.g., `AppDetails`, `ClickHandler`)

#### Component Structure

```typescript
"use client"; // Only for client components

import { FC } from "react";

interface Props {
  userId: string;
  onSuccess?: () => void;
}

export const UserProfile: FC<Props> = ({ userId, onSuccess }) => {
  // Hooks at top
  const { config } = useConfig();
  const [loading, setLoading] = useState(false);

  // Event handlers
  const handleSubmit = async () => {
    // Implementation
  };

  // Render
  return (
    <div className="flex gap-4">
      {/* JSX */}
    </div>
  );
};
```

#### Path Aliases

Always use `@/` prefix for absolute imports:

```typescript
import { Button } from "@/components/ui/button";
import { useUser } from "@/providers/UserProvider";
import AppService from "@/services/app";
```

#### Dynamic Imports

Use for code splitting:

```typescript
const CreditHistory = dynamic(
  () => import("@/module/transactions-history/components/credit-history"),
  {
    loading: () => <div>Loading....</div>,
  }
);
```

#### TypeScript Configuration

- **Strict mode enabled**: `"strict": true`
- **Target**: `ES2017`
- **Module resolution**: `bundler`
- Always type function parameters and return values
- Avoid `any` - use proper types or `unknown`

### Solidity (Contracts)

#### Style

- **Version**: `pragma solidity 0.8.28;`
- **License**: Include SPDX identifier
- **Imports**: OpenZeppelin contracts (upgradeable variants)

#### Documentation

Use NatSpec comments:

```solidity
/**
 * @title TurboDAResolver
 * @author Rachit Anand Srivastava
 * @dev Contract description
 * @notice User-facing description
 */
contract TurboDAResolver {
    /**
     * @dev Event description
     * @param orderId The unique identifier
     * @param amount The deposited amount
     */
    event Deposit(
        bytes32 indexed orderId,
        uint256 amount
    );
}
```

#### Patterns

- Use OpenZeppelin upgradeable contracts
- Implement access control (`AccessControlDefaultAdminRulesUpgradeable`)
- Add reentrancy guards (`ReentrancyGuardTransientUpgradeable`)
- Pausable pattern for emergency stops
- Use `SafeERC20` for token operations

---

## Architecture Patterns

### Authentication & Authorization

- **Clerk JWT** for user authentication
- Extract user info via custom middleware
- Store user ID in request extensions
- API keys for programmatic access (hashed with Keccak256)

### Database Layer

- **Diesel ORM** with async PostgreSQL
- Separate `db` crate for models and controllers
- Connection pooling via `deadpool`
- Migrations tracked in `db/migrations/`

### State Management (Frontend)

- **Zustand** for global state
- React Context for providers (`AuthProvider`, `ConfigProvider`, `OverviewProvider`)
- Custom hooks for API interactions

### API Design

- RESTful endpoints with versioned paths (`/v1/...`)
- Structured JSON responses with `state`, `message`, `data`
- Bearer token authentication (`Authorization: Bearer <token>`)
- API key authentication (`x-api-key: <key>`)

### Observability

- OpenTelemetry integration via `observability` crate
- Custom logging utilities in `logger` module
- Tracing for distributed systems

---

## Common Patterns & Conventions

### Environment Configuration

All services use environment variables or `config.toml`:

```bash
# Required for all Rust services
DATABASE_URL=postgres://user:password@localhost:5432/turbo_da_core
REDIS_URL=redis://localhost:6379

# Service-specific
PORT=8080
MAX_POOL_SIZE=16
AVAIL_RPC_ENDPOINT_1=wss://...
```

### Error Messages

Be descriptive and actionable:

```rust
// Good
HttpResponse::BadRequest().json(json!({
    "state": "ERROR",
    "message": "Invalid app_id: must be a valid UUID"
}))

// Avoid
HttpResponse::BadRequest().body("Error")
```

### Async/Await

```rust
// Always use async for I/O operations
pub async fn fetch_user(conn: &mut AsyncPgConnection) -> Result<User, Error> {
    users::table
        .first(conn)
        .await
}
```

### Testing Approach

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[actix_web::test]
    async fn test_user_registration() {
        // Setup test database
        let db = TestDB::init();

        // Create test app
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(db.dbc.postgres.clone()))
                .service(register_new_user)
        ).await;

        // Make request
        let req = test::TestRequest::post()
            .uri("/register_new_user")
            .set_json(&payload)
            .to_request();

        // Assert response
        let response = test::call_service(&app, req).await;
        assert_eq!(response.status(), 200);
    }
}
```

---

## Critical Rules

### DO:

- ✅ Use workspace dependencies (check root `Cargo.toml` before adding new)
- ✅ Validate input with `validator` crate
- ✅ Use `BigDecimal` for financial calculations (never `f64`)
- ✅ Use path aliases (`@/`) in TypeScript
- ✅ Run `cargo test` and `forge test` before committing

### DON'T:

- ❌ Use `any` in TypeScript without justification
- ❌ Use floating-point for money calculations
- ❌ Commit `.env` files or secrets
- ❌ Use `unwrap()` in production Rust code without error context
- ❌ Skip database migrations

## KNOWN ISSUES / TODOs

- **No CI/CD**: Missing `.github/workflows` - builds/tests are manual
- **No frontend tests**: Dashboard lacks Jest/Vitest setup
- **Legacy TOKEN_MAP**: `dashboard/src/lib/types.ts` - marked for deprecation
- **Migration cleanup**: `db/src/controllers/customer_expenditure.rs` - remove temp function after migration

---

## Quick Reference

### Running Local Development

1. **Start PostgreSQL** (required for all services)
2. **Run migrations**: `cd db && ./migration.sh config.json`
3. **Start backend**: `cd turbo-da-core && cargo run`
4. **Start data submission**: `cd data_submission && cargo run`
5. **Start frontend**: `cd dashboard && pnpm run dev`

### Key Dependencies

**Rust**: actix-web 4.8, diesel 2.2, tokio 1.x, serde 1.0, uuid 1.8, avail-rust  
**TypeScript**: Next.js 15, React 19, TypeScript 5, Tailwind CSS 4  
**Solidity**: Foundry, OpenZeppelin Contracts 5.x

### Useful Files

- `Cargo.toml` (root): Workspace configuration
- `dashboard/package.json`: Frontend dependencies
- `db/schema.rs`: Database schema
- `turbo-da-core/config.toml.example`: Configuration template
- `contracts/foundry.toml`: Solidity compiler settings

---

**Note**: This codebase uses workspace dependencies extensively. Always check the root `Cargo.toml` for shared dependency versions before adding new ones.
