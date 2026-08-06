# Phase 5 Identity + Env Preflight Checklist

**Program:** PICK_VN Canonical Navigation  
**Phase:** 5  
**Gate token:** `PREVIEW_GO=YES_AFTER_IDENTITY_AND_ENV_PREFLIGHT`  
**Owner decisions:** [`PHASE5_OWNER_DECISIONS_RECORDED.md`](./PHASE5_OWNER_DECISIONS_RECORDED.md)  
**Machine-readable:** [`PHASE5_IDENTITY_ENV_PREFLIGHT.json`](./PHASE5_IDENTITY_ENV_PREFLIGHT.json)

## Current gate status

**`PREVIEW_GO=YES — DRAFT_PR_AUTHORIZED`**

Owner attestation: [`PHASE5_OWNER_ATTESTATION.md`](./PHASE5_OWNER_ATTESTATION.md).  
Identity coverage closed. Preview flag ON (Vercel Preview only). Production flag OFF_OR_ABSENT; Production env/redeploy/promote = NO.

---

## A. Production isolation (Required)

| ID | Check | Owner action | Status |
|----|-------|--------------|--------|
| ISO-01 | Record Production deployment id / SHA baseline for `pickvn.app` | Owner attestation: no Production promote/redeploy | **PASS** |
| ISO-02 | Confirm Production `VITE_CANONICAL_APP_SHELL_ENABLED` is OFF or absent | Owner: `PRODUCTION_FLAG_STATE=OFF_OR_ABSENT` | **PASS** |
| ISO-03 | Confirm no Production Redeploy planned for Phase 5 | Owner: `PRODUCTION_REDEPLOYED=NO` | **PASS** |

---

## B. Vercel Preview flag (Required — OD-P5-FLAG)

| ID | Check | Owner action | Status |
|----|-------|--------------|--------|
| ENV-01 | Set `VITE_CANONICAL_APP_SHELL_ENABLED=true` on **Preview** only | Owner: Preview value `true`, scope confirmed | **PASS** |
| ENV-02 | Confirm Production column for same key remains OFF/absent | Owner: `true_NOT_PRESENT` / OFF_OR_ABSENT | **PASS** |
| ENV-03 | Acknowledge Vite bake-time: Draft PR build must occur **after** ENV-01 | Owner PREVIEW_GO=YES after flag set | **PASS** |
| ENV-04 | Netlify not required for first pass | OD-P5-ENV | **PASS** (binding) |

**Agent must not set env values.**

---

## C. Identities (Required / Limited)

Credentials: operator vault / gitignored Staging QA env only. **Never** paste into Git, reports, logs, screenshots, or PR comments.

### C1 — Identity coverage (CLOSED)

| Role | Owner decision | Status |
|------|----------------|--------|
| PLATFORM_ADMIN | OD-P5-PLATFORM-ADMIN = Package **A** reuse existing Staging SUPER_ADMIN | **PASS** |
| COACH | OD-P5-COACH = Package **D** waive → `WAIVED_WITH_KNOWN_SCHEMA_GAP` | **WAIVED** |

| ID | Check | Status |
|----|-------|--------|
| ID-PA-01 | PLATFORM_ADMIN-equivalent via existing SUPER_ADMIN (non-Production) | **PASS** |
| ID-PA-02 | Credentials remain operator-vault only (no new user) | **PASS** |
| ID-CO-01 | COACH provisioned | **WAIVED** |
| ID-CO-02 | COACH password vault | **WAIVED** (N/A) |

Backlog: [`PHASE5_BACKLOG_COACH_ROLE_SUPPORT.md`](./PHASE5_BACKLOG_COACH_ROLE_SUPPORT.md)  
Mutation GOs: Auth/DB/Schema/Migration = **NO**.

### C2 — Limited roles (OD-P5-LIMITED_ROLES)

| Role | Staging verify | Limitation to document | Status |
|------|----------------|------------------------|--------|
| CLUB_MANAGER | **0** role rows | No Staging CLUB_MANAGER; first pass may skip dedicated CLUB_MANAGER menu cell or use Owner-mapped substitute and mark **LIMITED** | ☐ DOCUMENTED_AT_RECORDING |
| REFEREE | **0** role rows; `referee@staging.local` absent | No Staging REFEREE session user; Engine deny may use PLAYER; referee portal may use token path if available — mark **LIMITED** | ☐ DOCUMENTED_AT_RECORDING |
| CLUB_OWNER seed | `club@staging.local` is **PLAYER** | Role drift vs Staging docs — do not treat as CLUB_OWNER until Owner repairs; mark **LIMITED** | ☐ DOCUMENTED_AT_RECORDING |

### C3 — Ready baselines (informational)

| Role | Email (Staging) | Verify |
|------|-----------------|--------|
| SUPER_ADMIN | `admin@staging.local` | Present / active |
| VENUE_OWNER | `owner@staging.local` (+ `owner-b@` cross-tenant) | Present / active |
| VENUE_MANAGER | `manager@staging.local` | Present / active |
| PLAYER | `player@staging.local` | Present / active |

---

## D. Observability / trigger (binding)

| ID | Check | Status |
|----|-------|--------|
| OBS-01 | Manual browser acceptance only (OD-P5-OBSERVABILITY) | **PASS** (binding) |
| OBS-02 | No `VERCEL_AUTOMATION_BYPASS_SECRET` added for Phase 5 | **PASS** (binding) |
| TRG-01 | Draft PR only after this checklist closes | **BLOCKED** until Required PASS |
| RB-01 | Rollback plan = Preview flag OFF + Preview redeploy (OD-P5-ROLLBACK) | **PASS** (binding) |

---

## E. Release rule

| Condition | Result |
|-----------|--------|
| Identity coverage | **PASS** |
| ISO-01…03 + ENV-01…03 | **PASS** (Owner attestation) |
| `PREVIEW_GO` | **YES** |
| Authorized next step | **Draft PR** (docs only) per OD-P5-TRIGGER |
| After Draft PR Preview Ready | Manual flag-ON acceptance (Vercel only); COACH cells WAIVED |
| After acceptance | OD-P5-ROLLBACK |

---

## Safety

| Item | Value |
|------|------:|
| SQL mutations this preflight | **0** |
| Env changes by agent | **0** |
| Deployments | **0** |
| Draft PR | **NO** |
| Commit / push | **NO** |
| Credentials in artifacts | **NO** |
