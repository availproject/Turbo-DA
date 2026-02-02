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

## Task 4 Completion (Wave 2)

**Status**: ✅ COMPLETED

**Changes Made**:
- Removed 4 type definitions from `enigma/src/types.rs` (lines 48-72):
  - `AddParticipantRequest`
  - `AddParticipantResponse`
  - `DeleteParticipantRequest`
  - `DeleteParticipantResponse`
- Removed 2 commented methods from `enigma/src/lib.rs` (lines 166-242):
  - `add_participant()` method (38 lines)
  - `delete_participant()` method (38 lines)
- Removed route handlers from `turbo-da-core/src/routes/enigma_management.rs`:
  - Removed `AddParticipantRequest` and `DeleteParticipantRequest` from imports
  - Removed `add_participant()` route handler (98 lines)
  - Removed `delete_participant()` route handler (93 lines)
  - Removed unused `delete` import from actix_web
- Removed registrations from `turbo-da-core/src/main.rs`:
  - Removed `add_participant` and `delete_participant` from imports (line 55-56)
  - Removed `.service(add_participant)` registration (line 185)
  - Removed `.service(delete_participant)` registration (line 186)

**Verification**:
- ✅ All types removed from enigma/src/types.rs (grep: no matches)
- ✅ All commented methods removed from enigma/src/lib.rs (grep: no matches)
- ✅ All route handlers removed from enigma_management.rs (grep: no pub async fn matches)
- ✅ All registrations removed from main.rs (grep: no matches)
- ✅ DB controller functions preserved (mpc_participants still used in register handler)
- ✅ `cargo check --all-targets` passes (0 errors, only pre-existing warnings)
- ✅ Committed: `refactor(enigma): remove obsolete add/delete participant endpoints`

**Key Notes**:
- DB controller functions `add_participants()` and `delete_participants()` intentionally preserved
- These are used in the `register()` handler and must not be removed
- Grep correctly identified them but they are not route handlers
- All 4 files modified successfully
- No breaking changes to existing functionality

**Blockers Resolved**: None
**Blocks**: Task 5 (Add route handlers in turbo-da-core)

## Task 5 Completion (Wave 3)

**Status**: ✅ COMPLETED

**Changes Made**:
- Updated imports in `turbo-da-core/src/routes/enigma_management.rs` (lines 8-14) to include 4 new change_signers types:
  - `CreateChangeSignersRequest`
  - `ListChangeSignersQuery`
  - `SubmitChangeSignersSignatureRequest`
- Added 4 new route handlers at end of file (before hex_string_to_fixed_bytes):
  1. `create_change_signers()` - POST /change_signers/create, returns 201 Created on success
  2. `list_change_signers()` - GET /change_signers/list with query params
  3. `get_change_signers()` - GET /change_signers/{request_id}, handles 404 specially
  4. `submit_change_signers_signature()` - POST /change_signers/{request_id}/sign

**Verification**:
- ✅ All 4 handlers present (grep count: 4)
- ✅ No LSP diagnostics errors in enigma_management.rs
- ✅ `cargo check -p turbo-da-core` passes (0 errors)
- ✅ Handlers follow existing patterns (create_decrypt_request, submit_signature)
- ✅ Proper HTTP methods: #[post(...)] and #[get(...)]
- ✅ Tracing instrumentation with info/error logs
- ✅ Error format: `json!({"error": e.to_string()})`
- ✅ Success format: `json!({"success": true})` or response struct
- ✅ 404 handling for get_change_signers with special EnigmaError::Api match

**Key Notes**:
- Handlers placed before `use hex;` as specified
- All handlers use `web::Json<T>` or `web::Query<T>` or `web::Path<String>` as appropriate
- submit_change_signers_signature extracts fields from serde_json::Value body manually
- No DB operations - enigma service is source of truth
- Existing handlers (register, create_decrypt_request, etc.) not modified

**Blockers Resolved**: None
**Blocks**: Task 6 (Register routes in main.rs)

## Task 6 Completion (Wave 3)

**Status**: ✅ COMPLETED

**Changes Made**:
- Updated imports in `turbo-da-core/src/main.rs` (lines 54-57) to include 4 new change_signers handlers:
  - `create_change_signers`
  - `list_change_signers`
  - `get_change_signers`
  - `submit_change_signers_signature`
- Updated route registrations in `turbo-da-core/src/main.rs` (lines 183-192) to register new handlers:
  - Added 4 new `.service()` calls under `web::scope("/enigma")`
  - Placed new handlers first in the service chain (before existing decrypt handlers)
  - Kept all existing handlers (create_decrypt_request, get_decrypt_request, list_decrypt_requests, get_participant_apps, submit_signature)

**Verification**:
- ✅ All 4 new handlers imported (grep count: 7 matches - 4 in imports, 4 in registrations, minus 1 for overlap)
- ✅ No old add_participant/delete_participant handlers present (grep: no matches)
- ✅ No LSP diagnostics errors in main.rs
- ✅ `cargo check -p turbo-da-core` passes (0 errors)
- ✅ Committed: `feat(routes): register change_signers endpoints, remove old ones`

**Key Notes**:
- New handlers registered first in service chain as per conventions
- All existing handlers preserved and functional
- Import order: alphabetical within enigma_management module
- Route registration order: new change_signers handlers first, then existing decrypt handlers

**Blockers Resolved**: None
**Blocks**: Task 7 (Final verification)
