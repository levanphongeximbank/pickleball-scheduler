# Tournament Production Audit Report

**Date:** 2026-08-05  
**Final verdict:** `TOURNAMENT_PRODUCTION_AUDIT_COMPLETE_READY_FOR_IMPLEMENTATION`  
**Production GO:** **NO**  
**Production mutations:** 0  
**MCP:** `supabase-production` (`expuvcohlcjzvrrauvud`, `read_only=true`, `features=database`)  
**Authoritative Production query transport:** supabase-production MCP (not `scripts/tournament-production-readonly-audit.mjs`)  
**Audit script commit eligibility:** `NO_LOCAL_AUDIT_HELPER`  
**MCP config commit eligibility:** **NO** (`.cursor/mcp.json` = LOCAL_ONLY_NOT_COMMIT_ELIGIBLE)  
**Screenshot originals:** 6 × `LOCAL_EVIDENCE_ONLY` / `commitEligibility=NO_PENDING_REDACTION` (not Git-commit package)  
**Remediation first WP:** WP1 preserve/export browser-local tournaments  
**Prior independent review:** `TOURNAMENT_PRODUCTION_AUDIT_INDEPENDENT_REVIEW_FAIL_NO_COMMIT` (preserved; commit-gate corrections applied; re-review required)

## Consistency gate (reconciled)

### A. Primary route classification (sum = 54)

| Class | Count |
|-------|------:|
| CANONICAL | 8 |
| LEGACY | 46 |
| DUPLICATE | 0 |
| SHADOW | 0 |
| DEAD | 0 |
| UNRESOLVED | 0 |
| **Sum** | **54** |

Prior `8+44+7` error: `DUPLICATE=7` was a **secondary** Engine 4.0↔legacy conflict attribute, not a primary class.

### B. Secondary route attributes

| Attribute | Count |
|-----------|------:|
| DUPLICATE_CONFLICT_ROUTE_COUNT | 7 |
| ROUTE_CONFLICT_COUNT | 1 |
| LEGACY_ACTIVE_RUNTIME_COUNT | 4 |
| COMPATIBILITY_REDIRECT_COUNT | 0 |
| ENGINE_4_ROUTE_COUNT | 7 |
| PUBLIC_ROUTE_COUNT | 1 |
| RELATED_PORTAL_ROUTE_COUNT | 3 |

### Production object counters (reconciled)

| Counter | Value |
|---------|------:|
| PRODUCTION_CONTAINER_ROWS_INSPECTED | 1 |
| PRODUCTION_DURABLE_TOURNAMENT_RECORDS_INSPECTED | 0 |
| OWNER_TOURNAMENT_IDS_REQUESTED | 3 |
| OWNER_TOURNAMENT_IDS_FOUND | 0 |
| OWNER_TOURNAMENT_IDS_ABSENT | 3 |

**Definition:** A `club_data_v3` row with `tournaments_len=0` is a **container** inspection, not a tournament object.

### Runtime authority counters (reconciled 2026-08-05)

| Counter | Value | Notes |
|---------|------:|-------|
| DURABLE_WRITER_COUNT | 6 | Unchanged |
| DUAL_WRITER_COUNT | 3 | DW-01, DW-02, **DW-03 added** (team blob vs cloud RPC) |
| DUAL_READER_COUNT | 4 | Unchanged |
| LOCALSTORAGE_MOCK_FALLBACK_COUNT | 3 | LMF-01..LMF-03; prior **4** reduced (referee `!isSecureRuntime` not Production-reachable) |

Authoritative arrays: `TOURNAMENT_RUNTIME_AUTHORITY_MATRIX.json` → `dualWriterPatterns`, `localStorageMockFallbackPaths`.  
Reconciliation record: `evidence/RUNTIME_AUTHORITY_COUNTER_RECONCILIATION_2026-08-05.json`.

## Owner root-cause classifications

| ID | Root cause |
|----|------------|
| tournament-1785921300822 | `LOCAL_BROWSER_ONLY_OBJECT` |
| tournament-1785921409840 | `LOCAL_BROWSER_ONLY_OBJECT` |
| tournament-1785921550968 | `LOCAL_BROWSER_ONLY_OBJECT` |

**Proven localStorage key:** `pickleball-club-data-v3::{clubId}` via `getTournament` → `loadClubData` → `getClubDataKey`.

**ACCC tenant:** Production `clubs.tenant_id=venue-prod-main` — does not reach pairing because Daily/Official omit or substitute `default-tenant`; Internal dual-reader omits tenant in `prepareLivePrivatePairingOptions`.

**Cross-device:** same-browser refresh can preserve; other browser/device cannot (not in cloud). **Data-loss risk:** HIGH. **Migration required** for browser-local tournaments.

Machine report: `TOURNAMENT_PRODUCTION_AUDIT_REPORT.json`
