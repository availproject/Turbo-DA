# Enigma Modal: Signers Integration (Current Signers, Change Signers, Requests)

## TL;DR

> Quick Summary: Integrate three tabs inside the Enigma modal for each app: Current Signers (read-only participants + threshold), Change Signers (create request), and Requests (list + sign). Bind all flows to appData.id and reuse existing /v1/user/enigma routes.
>
> Deliverables:
> - Update Enigma modal (src/module/user-apps/enigma-modal.tsx) with three tabs and corresponding views
> - Adapt existing change signers UI to modal context, removing manual App ID entry
> - Wire EnigmaService calls for change_signers and a small client method for Current Signers endpoint
>
> Estimated Effort: Medium
> Parallel Execution: YES - in 2 waves (service + UI structure, then integrations)
> Critical Path: Service method → Modal tabs scaffolding → Integrate Current Signers → Integrate Change Signers → Integrate Requests

---

## Context

### Original Request
Move the "change signer", "current signers", and "current change signer request" tabs inside the Enigma modal.

### Interview Summary
- Tabs inside modal: Current Signers, Change Signers, Requests (full list)
- Data source: Use /v1/user/enigma routes; default Current Signers endpoint accepted: GET /v1/user/enigma/apps/{app_id}/signers (Bearer auth) → { participants: string[], threshold: number }
- Permissions: Any participant can create change-signer requests and sign
- Modal binding: Use appData.id; hide manual App ID field
- Test/Verification: Manual QA only (no new frontend test infra)

**Research Findings**
- EnigmaService already includes change_signers endpoints: create/list/get/sign, plus decrypt request flows
- Existing UI for change signers lives in src/module/enigma/components/manage-participants.tsx (list/create/detail/sign); can be adapted to modal
- No explicit "current signers" endpoint seen in turbo-da-core/src/main.rs; user accepted default spec

### Metis Review
Identified Gaps (addressed here):
- Confirm current signers endpoint contract → Default accepted; disclosed below
- Lock down scope creep: only modal integration, no new backend, no automated tests, limited UI polish
- Edge cases: no signers, no requests, permission-limited users, API errors, loading skeletons
- Acceptance criteria: include manual QA steps and clear error behaviors

---

## Work Objectives

### Core Objective
Enable users to view current participants/threshold, create a change-signers request, and view/sign existing change-signers requests directly within the Enigma modal for a specific app, using appData.id.

### Concrete Deliverables
- Enigma modal updated with three tabs and content panes
- Current Signers tab fetches and displays participants[] and threshold
- Change Signers tab creates a new change-signers request (bound to appData.id)
- Requests tab lists change-signers requests for this app and allows signing
- EnigmaService updated with a method to fetch current signers if missing

### Definition of Done
- [x] Enigma modal shows all 3 tabs and switches correctly
- [x] Each tab renders loading, success, and error states
- [x] API calls use Bearer auth and appData.id (no manual App ID entry)
- [x] Manual QA steps executed and accepted (see Verification Strategy)

### Must Have
- Bind all flows to appData.id
- Reuse existing /v1/user/enigma routes for change_signers
- Use Bearer token from providers (consistent with existing calls)

### Must NOT Have (Guardrails)
- Must NOT create or modify backend routes/services
- Must NOT add automated testing or new test infra
- Must NOT add non-required UI features (sorting, filtering, animations)
- Must NOT reintroduce manual App ID input in the modal

---

## Verification Strategy (MANDATORY)

Test Decision
- Infrastructure exists: Frontend tests not set up (per repo AGENTS.md)
- User wants tests: Manual QA only
- Framework: none

Manual QA Procedures (step-by-step)
1) Open modal
- Navigate to a page where Enigma modal is available (e.g., App list → open Enigma modal for a specific app)
- Assert: Modal opens; tabs are visible: Current Signers (default), Change Signers, Requests

2) Current Signers tab
- Assert: Shows a loading skeleton/spinner, then a list of participant addresses (monospace) and threshold
- Assert: If no signers, shows "No signers configured" message
- Error case: Temporarily break token or app_id to trigger 403/404 and assert error toast/banner appears

3) Change Signers tab (create request)
- Enter participants as comma-separated addresses and valid threshold
- Click Create; assert success toast and form reset; switching to Requests should show new request (if list supports immediate view)
- Error case: Submit invalid threshold (e.g., 0 or > participants count) and assert validation error displayed

4) Requests tab (list + sign)
- Assert: Requests list loads; each row shows request id snippet, status, threshold, participants count, created at
- Click Sign on a pending request (ensure wallet connected if required); assert success toast; list refresh updates signature counts/status
- Error case: Reject signing in wallet and assert user-rejected toast; simulate API error to assert error toast

5) Tab switching
- Switch tabs repeatedly; assert no layout shift breakage; data reloads appropriately or manual Refresh button works

Evidence (Optional if desired by executor)
- Screenshots of each tab state and toasts
- Console logs of API responses (non-sensitive)

---

## Execution Strategy

### Parallel Execution Waves
Wave 1 (Start Immediately):
- Task 1: EnigmaService addition for Current Signers (if not present)
- Task 2: Modal tab scaffolding in enigma-modal.tsx (UI only)

Wave 2 (After Wave 1):
- Task 3: Integrate Current Signers tab data flow
- Task 4: Integrate Change Signers tab (adapt existing code; bind appData.id)
- Task 5: Integrate Requests tab (list + sign; adapt existing code)

Critical Path: Task 1 → Task 2 → Tasks 3–5 (can parallelize 4 & 5 after scaffolding)

### Dependency Matrix
- Task 3 depends on Task 1 (service method)
- Task 4, Task 5 depend on Task 2 (tabs in place)

### Agent Dispatch Summary
- Recommended executor category: unspecified-high + frontend-ui-ux for UI work
- No browser automation/tests in scope (manual QA only)

---

## TODOs

- [x] 1. Add/Confirm EnigmaService method: getCurrentSigners(app_id)
  What to do:
  - Add method in src/services/enigma/index.ts:
    - GET /v1/user/enigma/apps/{app_id}/signers (Bearer token)
    - Returns { participants: string[], threshold: number }
  - Handle errors: 404, 403, 500 → throw Error with message
  Must NOT do:
  - Must not alter backend; if route unavailable at runtime, surface clear error
  Recommended Agent Profile:
  - Category: unspecified-high
  - Skills: frontend-ui-ux (for TypeScript client patterns)
  Parallelization: YES (Wave 1)
  References (Why):
  - src/services/enigma/index.ts: pattern for Bearer-auth fetch
  - turbo-da-core/src/main.rs: enigma scope paths structure
  Acceptance Criteria:
  - Method exists and compiles; returns parsed JSON
  - Manual QA: Call method in a controlled environment; confirm shape {participants[], threshold}

- [x] 2. Scaffold tabs in Enigma modal (enigma-modal.tsx)
  What to do:
  - Add three tabs: Current Signers (default), Change Signers, Requests
  - Maintain tab state; preserve existing decrypt request tabs by integrating or replacing per design (decide placement)
  Must NOT do:
  - Must not reintroduce manual App ID input
  Recommended Agent Profile:
  - Category: visual-engineering
  - Skills: frontend-ui-ux
  Parallelization: YES (Wave 1)
  References:
  - src/module/user-apps/enigma-modal.tsx: current modal structure and tab patterns for decrypt requests
  Acceptance Criteria:
  - Tabs render and switch; default tab is Current Signers

- [x] 3. Integrate Current Signers tab (data & UI)
  What to do:
  - On tab active, fetch current signers using appData.id and token
  - Render participants (monospace list) and threshold
  - Loading and error states
  Must NOT do:
  - Must not show manual App ID field
  Recommended Agent Profile:
  - Category: visual-engineering
  - Skills: frontend-ui-ux
  Parallelization: YES (Wave 2)
  References:
  - src/services/enigma/index.ts: new getCurrentSigners method
  - src/module/user-apps/enigma-modal.tsx: tab container
  Acceptance Criteria:
  - Manual QA: Tab shows accurate data; error and loading states tested

- [x] 4. Integrate Change Signers tab (create request)
  What to do:
  - Adapt logic from src/module/enigma/components/manage-participants.tsx (ChangeSignersCreate)
  - Replace manual App ID with appData.id
  - Validate participants[] and threshold before submit
  - On success, clear form and show toast
  Must NOT do:
  - Must not add role-based UI; any participant may create per spec
  Recommended Agent Profile:
  - Category: visual-engineering
  - Skills: frontend-ui-ux
  Parallelization: YES (Wave 2)
  References:
  - src/module/enigma/components/manage-participants.tsx: create flow
  - src/services/enigma/index.ts: createChangeSignersRequest
  Acceptance Criteria:
  - Manual QA: Create request succeeds; failure paths show toasts

- [x] 5. Integrate Requests tab (list + sign)
  What to do:
  - Adapt list and detail/sign flows from manage-participants.tsx (list/detail/sign)
  - Show paginated list (reuse PAGE_SIZE=10 pattern) for this app's requests
  - Provide Sign action (wallet flow) and update list on success
  Must NOT do:
  - Must not implement search/filtering/sorting
  Recommended Agent Profile:
  - Category: visual-engineering
  - Skills: frontend-ui-ux
  Parallelization: YES (Wave 2)
  References:
  - src/module/enigma/components/manage-participants.tsx: list, detail, signing logic
  - src/services/enigma/index.ts: listChangeSignersRequests, getChangeSignersRequest, submitChangeSignersSignature
  Acceptance Criteria:
  - Manual QA: Requests load; signing works (success + rejected + error)

---

## References (CRITICAL)

Pattern References (existing code to follow)
- src/module/user-apps/enigma-modal.tsx: existing tabbed modal patterns (decrypt requests)
- src/module/enigma/components/manage-participants.tsx: change signers list/create/detail/sign patterns to adapt

API/Type References
- src/services/enigma/index.ts: EnigmaService change_signers methods (create/list/get/sign)
- src/services/enigma/response.ts: ChangeSignersRequest and related types

Documentation References
- AGENTS.md (dashboard): Notes no frontend test infra; manual testing expected
- turbo-da-core/src/main.rs: Enigma route scope under /v1/user/enigma

External References
- None required beyond existing codebase patterns

Why Each Reference Matters
- enigma-modal.tsx: Ensures stylistic and structural consistency inside modal
- manage-participants.tsx: Prevents re-implementation; proven flows for create/list/sign
- enigma/index.ts and response.ts: Single source of truth for API wiring and types
- main.rs: Confirms route scopes and naming conventions for /v1/user/enigma

---

## Success Criteria

Verification Commands (for backend connectivity via curl; adjust base URL/TOKEN)
- Current Signers (spec agreed as default):
  curl -s -H "Authorization: Bearer $TOKEN" \
    "$API_URL/v1/user/enigma/apps/$APP_ID/signers" | jq '{participants, threshold}'
  - Expected: participants is array of strings; threshold is number

- Create Change Signers Request:
  curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    "$API_URL/v1/user/enigma/change_signers/create" \
    -d '{"turbo_da_app_id":"'$APP_ID'","new_participants":["0x..."],"new_threshold":2}' | jq '.'
  - Expected: success: true (per response types)

- List Change Signers Requests:
  curl -s -H "Authorization: Bearer $TOKEN" \
    "$API_URL/v1/user/enigma/change_signers/list?turbo_da_app_id=$APP_ID&limit=10&offset=0" | jq '.items | length'
  - Expected: number >= 0

- Submit Signature:
  curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    "$API_URL/v1/user/enigma/change_signers/$REQUEST_ID/sign" \
    -d '{"request_id":"'$REQUEST_ID'","participant_address":"'$WALLET'","signature":"$SIG"}' | jq '{status, signatures_submitted, threshold}'
  - Expected: status reflects server-side aggregation; signatures_submitted <= threshold

Final Checklist
- [x] Tabs rendered and functional with loading/error states
- [x] Current Signers displays participants[] and threshold
- [x] Change Signers request creation works; validations enforced
- [x] Requests list loads; Sign action works; errors handled
- [x] Manual QA steps executed and acceptable

---

## Defaults Applied (override if needed)
- Current Signers endpoint spec: GET /v1/user/enigma/apps/{app_id}/signers (Bearer) → { participants: string[], threshold: number }
- Initial tab: Current Signers
- Data refresh: Manual refresh buttons where necessary; reload on tab revisit
- Error handling: Toasts for transient errors; inline message in tab body; no auto-retry

## Auto-Resolved (minor gaps)
- Bound all flows to appData.id; removed manual App ID input across tabs
- Reused existing EnigmaService patterns for consistent headers and error handling

## Guardrails Applied
- No backend changes; no automated tests; minimal UI additions necessary for functionality
- No search/filter/sort; no animations; no role-based UI beyond permission checks surfaced by API

---