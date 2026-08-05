# Tournament Runtime Authority Matrix

**Audit date:** 2026-08-05  
**Method:** Static code + owner screenshot evidence  
**Production mutations:** 0

## Live Production reconciliation (2026-08-05)

| Fact | Evidence |
|------|----------|
| Owner tournament IDs in `club_data_v3` | **0** (Q-001–Q-003, text scan) |
| Cloud tournament objects | **0** (Q-005) |
| ACCC `clubs.tenant_id` | `venue-prod-main` (Q-004) — not `default-tenant` |
| Durable authority for Owner defects | **Client localStorage** `pickleball-club-data-v3::{clubId}` |
| Cloud sync state | 1 blob row, empty `tournaments[]` |

**Implication:** Missing-tenant UI errors are **not** caused by absent Production club tenant rows. They are caused by dual-reader / default-tenant resolver / omitted `tenantId` wiring on legacy setup pages.

### Primary vs secondary route counters

Primary sum = 54 (CANONICAL 8 + LEGACY 46). Secondary `DUPLICATE_CONFLICT_ROUTE_COUNT=7` must not be added into the primary sum.

## Authority classifications

| Classification | Meaning |
|----------------|---------|
| LEGACY_ACTIVE_RUNTIME | Production user traffic uses legacy path as primary authority |
| DUPLICATE_RUNTIME | Parallel code path mutates same durable store differently |
| SHADOW_DUAL_PATH | Read from A, write to B, compare logged |
| CANONICAL_GATEWAY | Intended single gate; wiring incomplete on some pages |
| RPC_SCOPED | Supabase RPC is production write authority |
| HARD_CUTOVER_WRITER | SSOT finalize path; legacy writes forbidden in secure runtime |

## Individual tournament (Daily / Internal / Official)

| Layer | Authority | Store |
|-------|-----------|-------|
| Reader | `getTournament(clubId, id)` | `pickleball-club-data-v3::{clubId}` |
| Writer | `updateTournament` / `createTournament` | Same blob |
| Cloud | `syncClubToCloud` → `club_data_v3` | Full club blob (not per-tournament RPC) |
| Engine 4.0 | `settings.engineV4` in same blob | `/tournaments/:id/*` |

**Finding (TP-UI-004):** Legacy setup routes and Engine 4.0 coexist without redirect. Both are active runtime authorities on the same blob record.

## Tenant resolution split (HIGH)

| Resolver | Behavior | Used by |
|----------|----------|---------|
| `resolveTenantIdForClub` | Falls back to `default-tenant` | Official tenant memo, createTournament stamp |
| `resolvePairingScopeTenantId` | Rejects placeholder; returns null | Athlete pool (Internal/Team) |
| `resolveLivePairingScope` | Requires explicit tenantId in inputs | Private pairing rules |

**Symptom chain:** Official resolves `default-tenant` → tenant-wide pool rejects → TP-UI-003. Internal loads 34 players via strict resolver → guided flow omits tenant → TP-UI-002.

## Dual reader: Internal athlete pool vs pairing scope

```
useClubPairingCandidatePool / resolveTeamTournamentAthleteTenantId  → 34 eligible players ✓
prepareLivePrivatePairingOptions({ clubId, tournamentId })          → missing tenantId ✗
```

Team setup passes full scope (reference implementation).

## Dual writer patterns (reconciled count = 3)

| ID | Pattern | Writer A | Writer B |
|----|---------|----------|----------|
| DW-01 | blob_vs_cloud_club_sync | `saveClubData` → localStorage | `syncClubToCloud` → `club_data_v3` |
| DW-02 | engine4_settings_vs_events_direct | `settings.engineV4` | setup pages `events[]` |
| DW-03 | team_tournament_blob_vs_cloud_rpc | `patchTeamData` → blob `teamData` (legacy/shadow) | `team_tournament_*` RPCs via shadow cloud mutations |

**DW-03 proof:** With `VITE_TEAM_TOURNAMENT_SUPABASE=true`, mode defaults to **shadow**; setup still writes blob while portal/referee commands write cloud. Distinct from DW-01 (full club blob sync vs nested team aggregate / normalized TT tables). Q-006: `team_tournaments` total=56.

## Dual writer: blob local vs cloud sync (DW-01)

- **Local:** `saveClubData` immediate
- **Cloud:** `scheduleClubCloudPush` debounced 1.5s
- **Risk:** Writes under wrong `activeClubId` persist locally before cloud tenant guard

## LocalStorage / mock / fallback paths (reconciled count = 3)

| ID | Type | Mechanism |
|----|------|-----------|
| LMF-01 | LOCALSTORAGE | `pickleball-club-data-v3::{clubId}` via tournamentService/clubStorage |
| LMF-02 | FALLBACK | `resolveTenantIdForClub` → `default-tenant` |
| LMF-03 | MOCK | Public catalog `MOCK_TOURNAMENTS` via `allowMockFallback` |

**Rejected as LMF-04:** referee direct `tournament_match_live` write when `!isSecureRuntime` — **not** Production-reachable (`isSecureRuntime()` is true on PROD builds). Prior asserted count of **4** was unsupported.

## Team tournament modes

| Mode | Read | Write |
|------|------|-------|
| legacy | Blob | Blob setup via legacy adapters |
| shadow | Blob + cloud compare | **Dual:** blob setup (`patchTeamData`) + cloud command RPCs |
| cloud_primary | Cloud | Cloud RPC (TT-1B runtime-blocked) |

## Guards inventory

| Guard | Scope |
|-------|-------|
| `TournamentManageGate` | Daily/Internal/Official organizer pages |
| `assertTournamentAccess` | Club + record tenant match |
| `RouteAccessGate` | `/tournament/*` → TOURNAMENT_VIEW |
| `PermissionGate` | Engine 4.0 TOURNAMENT_UPDATE |
| `resolveLivePairingScope` | Fail-closed before rule load |

**Gap:** UI action buttons not disabled when tenant missing; errors surface on click.

Machine-readable matrix: `TOURNAMENT_RUNTIME_AUTHORITY_MATRIX.json`
