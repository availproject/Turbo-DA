# Change Signers Migration - Learnings & Conventions

## Project Conventions

### Type Definitions (enigma/src/types.rs)
- Use `#[derive(Debug, Serialize, Deserialize, Clone)]` for request types
- Use `#[derive(Debug, Serialize, Deserialize)]` for response types
- Use `#[derive(Debug, Deserialize)]` for query/get types (no Serialize needed)
- Field order: id, turbo_da_app_id, then other fields
- Use `Uuid` for IDs, `String` for addresses, `Vec<String>` for participant lists
- Timestamps as `i64` (Unix epoch), optional timestamps as `Option<i64>`

### Service Methods (enigma/src/lib.rs)
- Pattern: `pub async fn method_name(&self, payload: Type) -> Result<ResponseType, EnigmaError>`
- URL format: `format!("{}/v1/endpoint", self.service_url)`
- Always log status and body: `tracing::info!(%status, %body, "enigma method_name response")`
- Error handling: Return `EnigmaError::Api` for non-success status, `EnigmaError::Parse` for JSON errors
- Use `?` operator for reqwest operations

### Route Handlers (turbo-da-core/src/routes/enigma_management.rs)
- Use `#[tracing::instrument(skip(enigma), fields(...))]` for instrumentation
- Use `#[post("/path")]`, `#[get("/path")]`, `#[delete("/path")]` attributes
- Return `HttpResponse` directly
- Error format: `json!({"error": e.to_string()})`
- Success format: `json!({"success": true})` or response struct

### Route Registration (turbo-da-core/src/main.rs)
- Import handlers at top of file
- Register under `web::scope("/enigma")`
- Order: new handlers first, then existing ones

## External Enigma Service API

### Endpoints
- POST /v1/change_signers/create - 201 Created, empty body
- GET /v1/change_signers/list - Query params: turbo_da_app_id, status, limit, offset
- GET /v1/change_signers/{request_id} - Returns request details
- POST /v1/change_signers/{request_id}/sign - Body: participant_address, signature

### Signature Format
`"{request_id}:{turbo_da_app_id}:{keccak256_hash_of_new_participants}:{new_threshold}"`

## Critical Files
- enigma/src/types.rs - Type definitions
- enigma/src/lib.rs - EnigmaEncryptionService implementation
- turbo-da-core/src/routes/enigma_management.rs - Route handlers
- turbo-da-core/src/main.rs - Route registration

## Gotchas
- Don't remove mpc_participants DB controllers - used elsewhere
- Don't modify decrypt request flow
- Don't modify register endpoint
- Enigma service is source of truth - no local DB tracking for change_signers

## Task 1 Completion (Wave 1)

**Status**: ✅ COMPLETED

**Changes Made**:
- Added 8 new type definitions to `enigma/src/types.rs` (lines 162-228)
- Fixed `GetQuoteResponse` to include `Debug` derive (required by new types)
- All types follow established conventions from learnings

**Types Added**:
1. `CreateChangeSignersRequest` - Request to create change signers governance
2. `CreateChangeSignersResponse` - Success response for create
3. `ListChangeSignersQuery` - Query params for listing requests
4. `ChangeSignersRequestRecord` - Individual request record
5. `ListChangeSignersResponse` - Paginated list response
6. `GetChangeSignersRequest` - Query for single request
7. `SubmitChangeSignersSignatureRequest` - Signature submission
8. `SubmitChangeSignersSignatureResponse` - Signature submission response

**Verification**:
- ✅ All 8 types present in file (grep count: 8)
- ✅ No LSP diagnostics errors in types.rs
- ✅ Proper derives applied (Clone for requests, Debug for all)
- ✅ Committed: `feat(enigma): add change_signers types`

**Blockers Resolved**: None
**Blocks**: Task 3 (Add service methods)

## Task 2 Completion (Wave 1)

**Status**: ✅ COMPLETED

**Changes Made**:
- Removed 4 unused imports from `enigma/src/lib.rs` (lines 35-40)
  - `AddParticipantRequest`
  - `AddParticipantResponse`
  - `DeleteParticipantRequest`
  - `DeleteParticipantResponse`
- Commented out `add_participant()` method (lines 170-199) with TODO marker
- Commented out `delete_participant()` method (lines 201-237) with TODO marker

**Verification**:
- ✅ Imports removed from use statement (verified via sed)
- ✅ Both methods commented out with TODO: "Will be removed in favor of change_signers"
- ✅ No LSP diagnostics errors in lib.rs
- ✅ `cargo check -p enigma` passes (Finished in 5.76s)
- ✅ Code still compiles successfully

**Key Notes**:
- Imports remain in commented-out code (expected - grep finds them there)
- Types not removed from types.rs yet (Task 4 will handle full removal)
- Route handlers not modified (Task 3 will add new handlers, Task 4 will remove old ones)
- No commit created (will be combined with Task 4 per instructions)

**Blockers Resolved**: None
**Blocks**: Task 4 (Complete removal of old code)

## Task 3 Completion (Wave 2)

**Status**: ✅ COMPLETED

**Changes Made**:
- Updated imports in `enigma/src/lib.rs` (lines 35-45) to include 6 new change_signers types:
  - `ChangeSignersRequestRecord`, `CreateChangeSignersRequest`, `CreateChangeSignersResponse`
  - `ListChangeSignersQuery`, `ListChangeSignersResponse`
  - `SubmitChangeSignersSignatureRequest`, `SubmitChangeSignersSignatureResponse`
- Added 4 new async methods to `EnigmaEncryptionService` after line 239:
  1. `create_change_signers_request()` - POST /v1/change_signers/create, handles 201 Created with empty body
  2. `list_change_signers()` - GET /v1/change_signers/list with query params
  3. `get_change_signers_request()` - GET /v1/change_signers/{request_id}
  4. `submit_change_signers_signature()` - POST /v1/change_signers/{request_id}/sign

**Verification**:
- ✅ All 4 methods present (grep count: 4)
- ✅ No LSP diagnostics errors in lib.rs
- ✅ `cargo check -p enigma` passes (0 errors)
- ✅ Methods follow existing patterns (create_decrypt_request, submit_signature)
- ✅ Proper URL formatting with self.service_url
- ✅ Tracing logs for status and body
- ✅ Error handling with EnigmaError::Api and EnigmaError::Parse
- ✅ Commented-out add/delete methods preserved for Task 4

**Key Notes**:
- Methods placed after commented delete_participant method as specified
- All methods use ? operator for reqwest operations
- create_change_signers_request handles special case of 201 Created with empty body
- list_change_signers builds query params vector similar to list_decrypt_requests
- submit_change_signers_signature constructs JSON body manually for participant_address and signature

**Blockers Resolved**: None
**Blocks**: Task 5 (Add route handlers in turbo-da-core)
