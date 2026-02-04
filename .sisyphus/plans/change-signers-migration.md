# Work Plan: Migrate to Change Signers Governance

## TL;DR

> **Quick Summary**: Replace individual add/delete participant endpoints with threshold-based change_signers governance model. The external enigma service already has the API endpoints; we need to add client-side support in the local enigma crate and expose them through Turbo-DA's REST API.
> 
> **Deliverables**:
> - 8 new types in enigma library (CreateChangeSignersRequest, ListChangeSignersQuery, etc.)
> - 4 new service methods in EnigmaEncryptionService
> - 4 new route handlers in turbo-da-core
> - 2 old endpoint removals (add_participant, delete_participant)
> 
> **Estimated Effort**: Medium (~4-6 hours for experienced Rust dev)
> **Parallel Execution**: YES - enigma library work can happen in parallel with route refactoring
> **Critical Path**: Types → Service Methods → Routes → Registration

---

## Context

### Original Request
Migrate Turbo-DA from individual participant management (add_participant/delete_participant) to threshold-based governance (change_signers) that allows current authorized signers to approve changes to the participant list and threshold.

### Interview Summary
**Key Discussions**:
- Route structure: `/v1/enigma/change_signers/*` (nested under existing enigma scope)
- Backward compatibility: Remove old endpoints completely (no deprecation period)
- External enigma service already has change_signers endpoints implemented
- No local DB tracking needed - enigma service is source of truth
- Need endpoints to fetch/integrate with enigma service

### External Enigma Service API Contract

**Base URL**: Configured via `ENIGMA_ENCRYPTION_SERVICE_URL` in AppConfig

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/v1/change_signers/create` | POST | `{id, turbo_da_app_id, new_participants[], new_threshold}` | 201 Created (empty) |
| `/v1/change_signers/list` | GET | Query: `turbo_da_app_id`, `status`, `limit`, `offset` | `{requests[], total}` |
| `/v1/change_signers/{id}` | GET | Path: `request_id` | Request details |
| `/v1/change_signers/{id}/sign` | POST | `{participant_address, signature}` | Status with `tee_attestion` |

**Signature Format**: `"{request_id}:{turbo_da_app_id}:{keccak256_hash_of_new_participants}:{new_threshold}"`

### Metis Review
**Identified Gaps** (addressed):
- Verified external enigma service has the endpoints (user confirmed)
- Signature format clarified: keccak256 hash of new_participants list
- Error handling must match existing pattern: `{"error": "message"}`
- All verification will be automated (no human intervention required)

---

## Work Objectives

### Core Objective
Implement client-side support for the external enigma service's change_signers governance API, exposing it through Turbo-DA's REST API while removing obsolete individual participant management endpoints.

### Concrete Deliverables
1. **New Types** (`enigma/src/types.rs`):
   - `CreateChangeSignersRequest`, `CreateChangeSignersResponse`
   - `ListChangeSignersQuery`, `ListChangeSignersResponse`
   - `ChangeSignersRequestRecord`
   - `GetChangeSignersRequest`
   - `SubmitChangeSignersSignatureRequest`, `SubmitChangeSignersSignatureResponse`

2. **New Service Methods** (`enigma/src/lib.rs`):
   - `create_change_signers_request()`
   - `list_change_signers()`
   - `get_change_signers_request()`
   - `submit_change_signers_signature()`

3. **New Route Handlers** (`turbo-da-core/src/routes/enigma_management.rs`):
   - `POST /v1/enigma/change_signers/create`
   - `GET /v1/enigma/change_signers/list`
   - `GET /v1/enigma/change_signers/{request_id}`
   - `POST /v1/enigma/change_signers/{request_id}/sign`

4. **Removed Code**:
   - `AddParticipantRequest`, `AddParticipantResponse` types
   - `DeleteParticipantRequest`, `DeleteParticipantResponse` types
   - `add_participant()` service method
   - `delete_participant()` service method
   - `POST /v1/enigma/add_participant` route handler
   - `DELETE /v1/enigma/delete_participant` route handler

### Definition of Done
- [x] All 8 new types defined in `enigma/src/types.rs`
- [x] All 4 new service methods implemented in `enigma/src/lib.rs`
- [x] All 4 new route handlers implemented in `turbo-da-core/src/routes/enigma_management.rs`
- [x] New routes registered in `turbo-da-core/src/main.rs`
- [x] Old add/delete endpoints completely removed from all files
- [x] Code compiles without errors: `cargo check --all-targets`
- [x] All tests pass: `cargo test` (requires DATABASE_URL_TEST env var)

### Must Have
- New types must follow existing serde patterns (Serialize, Deserialize derives)
- Service methods must use existing error handling pattern (EnigmaError)
- Route handlers must use existing tracing instrumentation pattern
- Must preserve existing decrypt request flow (unchanged)
- Must preserve existing register endpoint (unchanged)

### Must NOT Have (Guardrails)
- MUST NOT modify decrypt request endpoints or types
- MUST NOT modify register endpoint behavior
- MUST NOT change mpc_participants DB controller functions (they're used for other purposes)
- MUST NOT break compilation at any intermediate step
- MUST NOT use human-verified acceptance criteria (all automated)

---

## Verification Strategy

### Test Infrastructure Assessment
- **Infrastructure exists**: YES (Rust has built-in test framework, project uses `cargo test`)
- **User wants tests**: Tests-after (add verification commands, not full TDD)
- **QA approach**: Automated verification via command-line tools

### Automated Verification (Agent-Executable)

**Type Definitions Verification:**
```bash
# Verify all new types exist in enigma/src/types.rs
grep -E "CreateChangeSignersRequest|CreateChangeSignersResponse|ListChangeSignersQuery|ListChangeSignersResponse|ChangeSignersRequestRecord|GetChangeSignersRequest|SubmitChangeSignersSignatureRequest|SubmitChangeSignersSignatureResponse" /Volumes/Personal/Avail/Turbo-DA/enigma/src/types.rs
# Expected: All 8 types found
```

**Service Methods Verification:**
```bash
# Verify all 4 new methods exist in enigma/src/lib.rs
grep -E "pub async fn (create_change_signers_request|list_change_signers|get_change_signers_request|submit_change_signers_signature)" /Volumes/Personal/Avail/Turbo-DA/enigma/src/lib.rs
# Expected: 4 matches
```

**Route Handlers Verification:**
```bash
# Verify new route handlers exist
grep -E "async fn (create_change_signers|list_change_signers|get_change_signers|submit_change_signers_signature)" /Volumes/Personal/Avail/Turbo-DA/turbo-da-core/src/routes/enigma_management.rs
# Expected: 4 matches
```

**Route Registration Verification:**
```bash
# Verify routes registered in main.rs
grep "change_signers" /Volumes/Personal/Avail/Turbo-DA/turbo-da-core/src/main.rs
# Expected: Multiple matches for route registration
```

**Old Endpoints Removal Verification:**
```bash
# Verify old endpoints are removed from routes file
! grep -q "add_participant\|delete_participant" /Volumes/Personal/Avail/Turbo-DA/turbo-da-core/src/routes/enigma_management.rs
# Expected: No matches (exit code 0 means NOT found)
```

**Compilation Verification:**
```bash
cd /Volumes/Personal/Avail/Turbo-DA && cargo check --all-targets 2>&1 | grep -E "^error" | wc -l
# Expected: 0
```

**Test Execution:**
```bash
cd /Volumes/Personal/Avail/Turbo-DA && cargo test 2>&1 | tail -20
# Expected: "test result: ok" with all tests passing
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Add types to enigma library
└── Task 2: Remove old add/delete participant code (comment out first)

Wave 2 (After Wave 1 completes):
├── Task 3: Add service methods to EnigmaEncryptionService
└── Task 4: Clean up old code completely

Wave 3 (After Wave 2 completes):
├── Task 5: Add route handlers
└── Task 6: Register routes in main.rs

Wave 4 (Final):
└── Task 7: Verify compilation and run tests

Critical Path: Task 1 → Task 3 → Task 5 → Task 6
Parallel Speedup: ~30% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 (Add types) | None | 3 | 2 |
| 2 (Remove old) | None | 4 | 1 |
| 3 (Add methods) | 1 | 5 | 4 |
| 4 (Clean up) | 2 | 7 | 3 |
| 5 (Add routes) | 3 | 6 | 4 |
| 6 (Register) | 5 | 7 | None |
| 7 (Verify) | 4, 6 | None | None |

---

## TODOs

- [x] 1. Add Change Signers Types to Enigma Library

  **What to do**:
  - Add 8 new type definitions to `/Volumes/Personal/Avail/Turbo-DA/enigma/src/types.rs`
  - Follow existing patterns with serde derives
  - Place after existing types (around line 161)

  **Must NOT do**:
  - Modify existing types
  - Remove existing types yet
  - Add business logic (types only)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None needed (straightforward type definitions)
  - **Reason**: Simple type additions following established patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3
  - **Blocked By**: None

  **References**:
  - Pattern reference: `enigma/src/types.rs:35-72` (AddParticipantRequest, DeleteParticipantRequest patterns)
  - Pattern reference: `enigma/src/types.rs:136-160` (ListDecryptRequestsQuery pattern)
  - Pattern reference: `enigma/src/types.rs:103-124` (SubmitSignatureRequest pattern)

  **New Types to Add**:
  ```rust
  // Lines ~162-250 (append to end of file)
  // Create Change Signers Request
  #[derive(Debug, Serialize, Deserialize, Clone)]
  pub struct CreateChangeSignersRequest {
      pub id: Uuid,
      pub turbo_da_app_id: String,
      pub new_participants: Vec<String>,
      pub new_threshold: i32,
  }
  
  #[derive(Debug, Serialize, Deserialize)]
  pub struct CreateChangeSignersResponse {
      pub success: bool,
  }
  
  // List Change Signers Query
  #[derive(Debug, Serialize, Deserialize, Clone)]
  pub struct ListChangeSignersQuery {
      pub turbo_da_app_id: String,
      pub status: Option<String>,
      pub limit: Option<u32>,
      pub offset: Option<u32>,
  }
  
  // Change Signers Request Record
  #[derive(Debug, Serialize, Deserialize)]
  pub struct ChangeSignersRequestRecord {
      pub id: String,
      pub turbo_da_app_id: String,
      pub new_participants: Vec<String>,
      pub new_threshold: i32,
      pub status: String,
      pub created_at: i64,
      pub updated_at: i64,
      pub completed_at: Option<i64>,
  }
  
  #[derive(Debug, Serialize, Deserialize)]
  pub struct ListChangeSignersResponse {
      pub items: Vec<ChangeSignersRequestRecord>,
      pub total: u32,
      pub offset: u32,
      pub limit: u32,
  }
  
  // Get Single Request
  #[derive(Debug, Deserialize)]
  pub struct GetChangeSignersRequest {
      pub request_id: String,
  }
  
  // Submit Signature
  #[derive(Debug, Serialize, Deserialize, Clone)]
  pub struct SubmitChangeSignersSignatureRequest {
      pub request_id: String,
      pub participant_address: String,
      pub signature: String,
  }
  
  #[derive(Debug, Serialize, Deserialize)]
  pub struct SubmitChangeSignersSignatureResponse {
      pub id: String,
      pub status: String,
      pub signatures_submitted: i32,
      pub threshold: i32,
      pub ready_to_execute: bool,
      pub tee_attestion: Option<GetQuoteResponse>,
  }
  ```

  **Acceptance Criteria**:
  - [x] `grep CreateChangeSignersRequest /Volumes/Personal/Avail/Turbo-DA/enigma/src/types.rs` returns match
  - [x] `grep ListChangeSignersQuery /Volumes/Personal/Avail/Turbo-DA/enigma/src/types.rs` returns match
  - [x] `grep ChangeSignersRequestRecord /Volumes/Personal/Avail/Turbo-DA/enigma/src/types.rs` returns match
  - [x] All 8 types are present

  **Commit**: YES
  - Message: `feat(enigma): add change_signers types`
  - Files: `enigma/src/types.rs`

---

- [x] 2. Remove Old Add/Delete Participant Code (Initial)

  **What to do**:
  - Comment out or mark for removal in preparation for deletion
  - Remove imports from `enigma/src/lib.rs` lines 35-40
  - Comment out `add_participant()` method in `enigma/src/lib.rs` lines 170-199
  - Comment out `delete_participant()` method in `enigma/src/lib.rs` lines 201-237

  **Must NOT do**:
  - Delete files yet
  - Modify other methods
  - Break compilation (comment, don't delete)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None needed
  - **Reason**: Simple removal of code sections

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - Target file: `enigma/src/lib.rs`
  - Lines to modify: 35-40 (imports), 170-199 (add_participant), 201-237 (delete_participant)

  **Acceptance Criteria**:
  - [x] `add_participant` and `delete_participant` imports removed or commented
  - [x] `add_participant` method commented out or marked with TODO
  - [x] `delete_participant` method commented out or marked with TODO

  **Commit**: NO (will be combined with Task 4)

---

- [x] 3. Add Change Signers Service Methods

  **What to do**:
  - Add 4 new async methods to `EnigmaEncryptionService` in `enigma/src/lib.rs`
  - Follow existing patterns from `create_decrypt_request()` and `submit_signature()`
  - Methods should call external enigma service endpoints

  **Must NOT do**:
  - Modify existing methods
  - Add business logic beyond HTTP calls
  - Handle DB operations (enigma service is source of truth)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: None needed
  - **Reason**: Requires careful HTTP client implementation matching existing patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1

  **References**:
  - Pattern reference: `enigma/src/lib.rs:284-319` (create_decrypt_request pattern)
  - Pattern reference: `enigma/src/lib.rs:371-408` (submit_signature pattern)
  - Pattern reference: `enigma/src/lib.rs:410-454` (list_decrypt_requests pattern)
  - New types from Task 1

  **Method Implementations**:
  ```rust
  // After line 237 (after delete_participant method)
  
  /// Creates a change signers request
  pub async fn create_change_signers_request(
      &self,
      payload: CreateChangeSignersRequest,
  ) -> Result<CreateChangeSignersResponse, EnigmaError> {
      let url = format!("{}/v1/change_signers/create", self.service_url);
      let response = self.client.post(&url).json(&payload).send().await?;
      let status = response.status();
      let body = response.text().await?;
      tracing::info!(%status, %body, "enigma create_change_signers_request response");
      if !status.is_success() {
          return Err(EnigmaError::Api { status: status.as_u16(), message: body });
      }
      // For 201 Created with empty body, return success
      if body.is_empty() || status == 201 {
          return Ok(CreateChangeSignersResponse { success: true });
      }
      let parsed: CreateChangeSignersResponse = serde_json::from_str(&body).map_err(|e| {
          EnigmaError::Parse { body: body.clone(), error: e.to_string() }
      })?;
      Ok(parsed)
  }
  
  /// Lists change signers requests
  pub async fn list_change_signers(
      &self,
      query: ListChangeSignersQuery,
  ) -> Result<ListChangeSignersResponse, EnigmaError> {
      let url = format!("{}/v1/change_signers/list", self.service_url);
      let mut params = vec![("turbo_da_app_id", query.turbo_da_app_id)];
      if let Some(status) = query.status { params.push(("status", status)); }
      if let Some(offset) = query.offset { params.push(("offset", offset.to_string())); }
      if let Some(limit) = query.limit { params.push(("limit", limit.to_string())); }
      let response = self.client.get(&url).query(&params).send().await?;
      let status = response.status();
      let body = response.text().await?;
      tracing::info!(%status, %body, "enigma list_change_signers response");
      if !status.is_success() {
          return Err(EnigmaError::Api { status: status.as_u16(), message: body });
      }
      let parsed: ListChangeSignersResponse = serde_json::from_str(&body).map_err(|e| {
          EnigmaError::Parse { body: body.clone(), error: e.to_string() }
      })?;
      Ok(parsed)
  }
  
  /// Gets a single change signers request
  pub async fn get_change_signers_request(
      &self,
      request_id: &str,
  ) -> Result<ChangeSignersRequestRecord, EnigmaError> {
      let url = format!("{}/v1/change_signers/{}", self.service_url, request_id);
      let response = self.client.get(&url).send().await?;
      let status = response.status();
      let body = response.text().await?;
      tracing::info!(%status, %body, "enigma get_change_signers_request response");
      if !status.is_success() {
          return Err(EnigmaError::Api { status: status.as_u16(), message: body });
      }
      let parsed: ChangeSignersRequestRecord = serde_json::from_str(&body).map_err(|e| {
          EnigmaError::Parse { body: body.clone(), error: e.to_string() }
      })?;
      Ok(parsed)
  }
  
  /// Submits a signature for a change signers request
  pub async fn submit_change_signers_signature(
      &self,
      payload: SubmitChangeSignersSignatureRequest,
  ) -> Result<SubmitChangeSignersSignatureResponse, EnigmaError> {
      let url = format!("{}/v1/change_signers/{}/sign", self.service_url, payload.request_id);
      let response = self.client.post(&url)
          .json(&json!({
              "participant_address": payload.participant_address,
              "signature": payload.signature
          }))
          .send().await?;
      let status = response.status();
      let body = response.text().await?;
      tracing::info!(%status, %body, "enigma submit_change_signers_signature response");
      if !status.is_success() {
          return Err(EnigmaError::Api { status: status.as_u16(), message: body });
      }
      let parsed: SubmitChangeSignersSignatureResponse = serde_json::from_str(&body).map_err(|e| {
          EnigmaError::Parse { body: body.clone(), error: e.to_string() }
      })?;
      Ok(parsed)
  }
  ```

  **Acceptance Criteria**:
  - [x] `grep "pub async fn create_change_signers_request" /Volumes/Personal/Avail/Turbo-DA/enigma/src/lib.rs` returns match
  - [x] `grep "pub async fn list_change_signers" /Volumes/Personal/Avail/Turbo-DA/enigma/src/lib.rs` returns match
  - [x] `grep "pub async fn get_change_signers_request" /Volumes/Personal/Avail/Turbo-DA/enigma/src/lib.rs` returns match
  - [x] `grep "pub async fn submit_change_signers_signature" /Volumes/Personal/Avail/Turbo-DA/enigma/src/lib.rs` returns match
  - [x] All 4 methods present

  **Commit**: YES
  - Message: `feat(enigma): add change_signers service methods`
  - Files: `enigma/src/lib.rs`

---

- [x] 4. Completely Remove Old Add/Delete Code

  **What to do**:
  - Delete old types from `enigma/src/types.rs`: AddParticipantRequest, AddParticipantResponse, DeleteParticipantRequest, DeleteParticipantResponse
  - Delete old imports from `enigma/src/lib.rs`
  - Delete old methods from `enigma/src/lib.rs`: add_participant(), delete_participant()
  - Delete old route handlers from `turbo-da-core/src/routes/enigma_management.rs`: add_participant, delete_participant
  - Remove route registrations from `turbo-da-core/src/main.rs`

  **Must NOT do**:
  - Remove mpc_participants DB controller functions (used elsewhere)
  - Modify decrypt request handlers
  - Modify register handler

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None needed
  - **Reason**: Simple deletion of obsolete code

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 7
  - **Blocked By**: Task 2

  **References**:
  - Types to remove: `enigma/src/types.rs:49-72` (Add/Delete participant types)
  - Imports to remove: `enigma/src/lib.rs:35-40`
  - Methods to remove: `enigma/src/lib.rs:170-237`
  - Routes to remove: `turbo-da-core/src/routes/enigma_management.rs:111-208` (add_participant), lines 210-302 (delete_participant)
  - Registrations to remove: `turbo-da-core/src/main.rs:185, 186`

  **Acceptance Criteria**:
  - [x] `! grep -q "AddParticipantRequest\|AddParticipantResponse\|DeleteParticipantRequest\|DeleteParticipantResponse" /Volumes/Personal/Avail/Turbo-DA/enigma/src/types.rs`
  - [x] `! grep -q "add_participant\|delete_participant" /Volumes/Personal/Avail/Turbo-DA/enigma/src/lib.rs`
  - [x] `! grep -q "add_participant\|delete_participant" /Volumes/Personal/Avail/Turbo-DA/turbo-da-core/src/routes/enigma_management.rs`

  **Commit**: YES
  - Message: `refactor(enigma): remove obsolete add/delete participant endpoints`
  - Files: `enigma/src/types.rs`, `enigma/src/lib.rs`, `turbo-da-core/src/routes/enigma_management.rs`

---

- [x] 5. Add Change Signers Route Handlers

  **What to do**:
  - Add 4 new route handlers to `turbo-da-core/src/routes/enigma_management.rs`
  - Follow existing patterns from create_decrypt_request, submit_signature handlers
  - Use proper tracing instrumentation
  - Return appropriate HTTP responses

  **Must NOT do**:
  - Add DB operations (enigma is source of truth)
  - Modify existing handlers
  - Break existing routes

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: None needed
  - **Reason**: Complex handler implementation requiring careful error handling

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 4 completion)
  - **Blocks**: Task 6
  - **Blocked By**: Task 3

  **References**:
  - Pattern reference: `turbo-da-core/src/routes/enigma_management.rs:335-433` (create_decrypt_request pattern)
  - Pattern reference: `turbo-da-core/src/routes/enigma_management.rs:539-589` (submit_signature pattern)
  - New types: `CreateChangeSignersRequest`, `ListChangeSignersQuery`, `SubmitChangeSignersSignatureRequest`

  **Handler Implementations** (append to end of file before helper functions):
  ```rust
  use enigma::types::{
      CreateChangeSignersRequest, ListChangeSignersQuery, 
      SubmitChangeSignersSignatureRequest, GetChangeSignersRequest
  };
  
  /// Create a new change signers request
  #[post("/change_signers/create")]
  pub async fn create_change_signers(
      request: web::Json<CreateChangeSignersRequest>,
      enigma: web::Data<EnigmaEncryptionService>,
  ) -> HttpResponse {
      tracing::info!("creating change signers request");
      match enigma.create_change_signers_request(request.into_inner()).await {
          Ok(_) => HttpResponse::Created().json(json!({"success": true})),
          Err(e) => {
              tracing::error!(error = %e, "failed to create change signers request");
              HttpResponse::InternalServerError().json(json!({"error": e.to_string()}))
          }
      }
  }
  
  /// List change signers requests
  #[get("/change_signers/list")]
  pub async fn list_change_signers(
      query: web::Query<ListChangeSignersQuery>,
      enigma: web::Data<EnigmaEncryptionService>,
  ) -> HttpResponse {
      tracing::info!("listing change signers requests");
      match enigma.list_change_signers(query.into_inner()).await {
          Ok(response) => HttpResponse::Ok().json(response),
          Err(e) => {
              tracing::error!(error = %e, "failed to list change signers requests");
              HttpResponse::InternalServerError().json(json!({"error": e.to_string()}))
          }
      }
  }
  
  /// Get a single change signers request
  #[get("/change_signers/{request_id}")]
  pub async fn get_change_signers(
      request_id: web::Path<String>,
      enigma: web::Data<EnigmaEncryptionService>,
  ) -> HttpResponse {
      tracing::info!(request_id = %request_id, "getting change signers request");
      match enigma.get_change_signers_request(&request_id).await {
          Ok(response) => HttpResponse::Ok().json(response),
          Err(e) => {
              tracing::error!(error = %e, "failed to get change signers request");
              match &e {
                  EnigmaError::Api { status, .. } if *status == 404 => {
                      HttpResponse::NotFound().json(json!({"error": "Request not found"}))
                  }
                  _ => HttpResponse::InternalServerError().json(json!({"error": e.to_string()}))
              }
          }
      }
  }
  
  /// Submit a signature for a change signers request
  #[post("/change_signers/{request_id}/sign")]
  pub async fn submit_change_signers_signature(
      request_id: web::Path<String>,
      body: web::Json<serde_json::Value>,
      enigma: web::Data<EnigmaEncryptionService>,
  ) -> HttpResponse {
      let participant_address = body.get("participant_address").and_then(|v| v.as_str()).unwrap_or("");
      let signature = body.get("signature").and_then(|v| v.as_str()).unwrap_or("");
      
      let payload = SubmitChangeSignersSignatureRequest {
          request_id: request_id.into_inner(),
          participant_address: participant_address.to_string(),
          signature: signature.to_string(),
      };
      
      tracing::info!("submitting change signers signature");
      match enigma.submit_change_signers_signature(payload).await {
          Ok(response) => HttpResponse::Ok().json(response),
          Err(e) => {
              tracing::error!(error = %e, "failed to submit change signers signature");
              HttpResponse::InternalServerError().json(json!({"error": e.to_string()}))
          }
      }
  }
  ```

  **Acceptance Criteria**:
  - [x] `grep "async fn create_change_signers" /Volumes/Personal/Avail/Turbo-DA/turbo-da-core/src/routes/enigma_management.rs` returns match
  - [x] `grep "async fn list_change_signers" /Volumes/Personal/Avail/Turbo-DA/turbo-da-core/src/routes/enigma_management.rs` returns match
  - [x] `grep "async fn get_change_signers" /Volumes/Personal/Avail/Turbo-DA/turbo-da-core/src/routes/enigma_management.rs` returns match
  - [x] `grep "async fn submit_change_signers_signature" /Volumes/Personal/Avail/Turbo-DA/turbo-da-core/src/routes/enigma_management.rs` returns match

  **Commit**: YES
  - Message: `feat(api): add change_signers route handlers`
  - Files: `turbo-da-core/src/routes/enigma_management.rs`

---

- [x] 6. Register New Routes in Main.rs

  **What to do**:
  - Import new route handlers in `turbo-da-core/src/main.rs`
  - Register new routes under the `/v1/user/enigma` scope
  - Remove old add/delete route registrations

  **Must NOT do**:
  - Change other route registrations
  - Modify auth middleware setup
  - Break existing route structure

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None needed
  - **Reason**: Simple import and route registration changes

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 5)
  - **Parallel Group**: Wave 3 (sequential after Task 5)
  - **Blocks**: Task 7
  - **Blocked By**: Task 5

  **References**:
  - Current imports: `turbo-da-core/src/main.rs:54-57`
  - Current registrations: `turbo-da-core/src/main.rs:183-192`

  **Changes Required**:
  ```rust
  // Line 54-57: Update imports
  use routes::enigma_management::{
      create_change_signers, create_decrypt_request, get_change_signers,
      get_decrypt_request, get_participant_apps, list_change_signers,
      list_decrypt_requests, submit_change_signers_signature, submit_signature,
  };
  
  // Lines 183-192: Update route registrations
  .service(
      web::scope("/enigma")
          .service(create_change_signers)
          .service(list_change_signers)
          .service(get_change_signers)
          .service(submit_change_signers_signature)
          .service(create_decrypt_request)
          .service(get_decrypt_request)
          .service(list_decrypt_requests)
          .service(get_participant_apps)
          .service(submit_signature),
  )
  ```

  **Acceptance Criteria**:
  - [x] `grep "create_change_signers\|list_change_signers\|get_change_signers\|submit_change_signers_signature" /Volumes/Personal/Avail/Turbo-DA/turbo-da-core/src/main.rs` returns 4+ matches
  - [x] `! grep "add_participant\|delete_participant" /Volumes/Personal/Avail/Turbo-DA/turbo-da-core/src/main.rs`

  **Commit**: YES
  - Message: `feat(routes): register change_signers endpoints, remove old ones`
  - Files: `turbo-da-core/src/main.rs`

---

- [x] 7. Verify Build and Tests

  **What to do**:
  - Run `cargo check --all-targets` to verify compilation
  - Run `cargo test` to verify all tests pass
  - Verify no old endpoint references remain
  - Verify all new types and methods are accessible

  **Must NOT do**:
  - Skip verification steps
  - Ignore compiler warnings
  - Ignore test failures

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None needed
  - **Reason**: Simple verification commands

  **Parallelization**:
  - **Can Run In Parallel**: NO (final verification)
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Tasks 4, 6

  **References**:
  - Build command: `cargo check --all-targets`
  - Test command: `cargo test`

  **Acceptance Criteria**:
  - [x] `cd /Volumes/Personal/Avail/Turbo-DA && cargo check --all-targets 2>&1 | grep -c "^error"` returns 0
  - [x] `cd /Volumes/Personal/Avail/Turbo-DA && cargo test 2>&1 | grep "test result"` shows "ok"
  - [x] All new types verified via grep
  - [x] All new methods verified via grep
  - [x] No old endpoint references remain

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(enigma): add change_signers types` | `enigma/src/types.rs` | grep types |
| 3 | `feat(enigma): add change_signers service methods` | `enigma/src/lib.rs` | grep methods |
| 4 | `refactor(enigma): remove obsolete add/delete participant endpoints` | `enigma/src/types.rs`, `enigma/src/lib.rs`, `turbo-da-core/src/routes/enigma_management.rs` | grep absence |
| 5 | `feat(api): add change_signers route handlers` | `turbo-da-core/src/routes/enigma_management.rs` | grep handlers |
| 6 | `feat(routes): register change_signers endpoints, remove old ones` | `turbo-da-core/src/main.rs` | grep registrations |

---

## Success Criteria

### Verification Commands
```bash
# Type verification
grep -E "CreateChangeSignersRequest|CreateChangeSignersResponse|ListChangeSignersQuery|ListChangeSignersResponse|ChangeSignersRequestRecord|GetChangeSignersRequest|SubmitChangeSignersSignatureRequest|SubmitChangeSignersSignatureResponse" /Volumes/Personal/Avail/Turbo-DA/enigma/src/types.rs

# Service methods verification
grep -E "pub async fn (create_change_signers_request|list_change_signers|get_change_signers_request|submit_change_signers_signature)" /Volumes/Personal/Avail/Turbo-DA/enigma/src/lib.rs

# Route handlers verification
grep -E "async fn (create_change_signers|list_change_signers|get_change_signers|submit_change_signers_signature)" /Volumes/Personal/Avail/Turbo-DA/turbo-da-core/src/routes/enigma_management.rs

# Route registration verification
grep "change_signers" /Volumes/Personal/Avail/Turbo-DA/turbo-da-core/src/main.rs

# Old endpoints removal verification
! grep -q "add_participant\|delete_participant" /Volumes/Personal/Avail/Turbo-DA/turbo-da-core/src/routes/enigma_management.rs && echo "Old endpoints removed"

# Build verification
cd /Volumes/Personal/Avail/Turbo-DA && cargo check --all-targets 2>&1 | grep -c "^error"
# Expected: 0

# Test verification
cd /Volumes/Personal/Avail/Turbo-DA && cargo test 2>&1 | grep "test result"
# Expected: ok
```

### Final Checklist
- [x] All 8 new types defined in `enigma/src/types.rs`
- [x] All 4 new service methods implemented in `enigma/src/lib.rs`
- [x] All 4 new route handlers implemented
- [x] New routes registered in `main.rs`
- [x] Old add/delete endpoints removed from all files
- [x] Code compiles without errors
- [x] All tests pass
- [x] No references to AddParticipantRequest/DeleteParticipantRequest remain
- [x] Error handling matches existing patterns
- [x] Tracing instrumentation added to all new handlers
