# Phase 1J-B — Staging Privacy Live Evidence

**Owner authorization:** `AUTHORIZE_PHASE_1J_B_STAGING_PRIVACY_EVIDENCE`
**Branch:** `feature/player-phase-1j-b-staging-privacy-evidence`
**Base `origin/main` SHA:** `ffe7ec8b89df6a643c0dac800b802ca5d3491f6b`
**Staging project:** `qyewbxjsiiyufanzcjcq`
**Production project:** `expuvcohlcjzvrrauvud` — **not accessed**
**Classification:** Evidence / certification only (no product change)
**Document verdict:** `READY_FOR_PHASE_1J_B_PRECOMMIT_REVIEW`

---

## 1. Objective

Certify that the authenticated Public Player Directory on Staging enforces the frozen Phase 1I privacy and masking contracts, using Owner-reviewable, sanitized evidence.

This phase does **not** change runtime, UI, routes, DTO, or SQL.

---

## 2. Evidence source decision

| Question | Decision |
|----------|----------|
| Are merged Phase 1J-A live reports sufficient? | **Yes** |
| Fresh Staging fixture seed/verify/cleanup required? | **No** |
| Staging writes under this authorization? | **None performed** |

### Cited merged reports (unchanged)

| Report | Path | Captured at (UTC) |
|--------|------|-------------------|
| Seed | `docs/player-management/phase-1j/evidence/STAGING_PM1JA_FIXTURE_SEED_REPORT.json` | `2026-07-21T15:34:40.770Z` |
| Verify | `docs/player-management/phase-1j/evidence/STAGING_PM1JA_FIXTURE_VERIFY_REPORT.json` | `2026-07-21T15:34:56.895Z` |
| Cleanup | `docs/player-management/phase-1j/evidence/STAGING_PM1JA_FIXTURE_CLEANUP_REPORT.json` | `2026-07-21T15:35:07.234Z` |

Merged via PR #140 (`docs/player-phase-1j-a-staging-evidence`). Fixture package via PR #135.

Machine-readable certification map (this phase):

- `docs/player-management/phase-1j/evidence/STAGING_PM1JB_PRIVACY_CERTIFICATION.json`

---

## 3. Contracts under test (frozen)

### Eligibility (must all hold for visibility)

```text
player_id present
AND display_name non-empty
AND identity_verification_status = 'verified'
AND privacy_settings.publicProfileEnabled = 'true'
AND status IS DISTINCT FROM 'suspended'
AND caller authenticated
```

### Directory-safe fields only (allow-list)

```text
player_id, display_name, is_verified, avatar_url, activity_region, gender, handedness
```

UI camelCase DTO: `playerId`, `displayName`, `isVerified`, `avatarUrl`, `activityRegion`, `gender`, `handedness`.

### Forbidden in directory responses (examples)

`privacy_settings`, `identity_verification_status`, raw `status`, auth uuid, email, phone, birth fields, venue/club/tenant, rejection/audit internals, `visible`, hide-reason codes.

### Masking

| Field | Emit only when |
|-------|----------------|
| `activity_region` | `showActivityRegion = true` else **null** |
| `gender` | `showGender = true` else **null** |
| `handedness` | `showHandedness = true` else **null** |

### Detail / cursor

- Ineligible / missing / hidden → indistinguishable null detail (`ok: true`, `data: null`).
- Invalid cursor → `INVALID_CURSOR` (no silent first-page reset).
- Search `meta` exposes page `count` / `limit` / `nextCursor` only — **no** hidden totals.

---

## 4. Fixture roles referenced (QA labels)

| Role | player_id | Expectation |
|------|-----------|-------------|
| eligible | `qa-pm1ja-eligible` | Visible; sport fields shown |
| masked | `qa-pm1ja-masked` | Visible; gender / handedness / activity_region null |
| hidden | `qa-pm1ja-hidden` | Excluded; detail null |
| suspended | `qa-pm1ja-suspended` | Excluded; detail null |
| unverified | `qa-pm1ja-unverified` | Excluded; detail null |
| nonexistent | `qa-pm1ja-nonexistent-0000` | Detail null |

Verifier account used in live capture: `player@staging.local` (authenticated directory only).

---

## 5. Mandatory assertion checklist

| # | Assertion | Source check name(s) in VERIFY report | Result |
|---|-----------|----------------------------------------|--------|
| 1 | Eligible public player appears in authenticated search | `eligible athlete appears in browse`, `eligible search by display_name` | **PASS** |
| 2 | Eligible public detail succeeds | `eligible detail returns strict fields` | **PASS** |
| 3 | Masked fields null / DTO-conformant | `masked detail keeps row but nulls masked fields` — `gender`, `handedness`, `activity_region` all `null`; `is_verified: true`; allow-listed keys only | **PASS** |
| 4 | Hidden excluded from search | `hidden athlete excluded from browse` | **PASS** |
| 5 | Hidden detail does not expose profile | `hidden detail is null` | **PASS** |
| 6 | Suspended excluded | `suspended athlete excluded from browse` + `suspended detail is null` | **PASS** |
| 7 | Unverified excluded | `unverified athlete excluded from browse` + `unverified detail is null` | **PASS** |
| 8 | No forbidden / internal fields returned | Eligible + masked detail payloads contain only allow-listed keys (`player_id`, `display_name`, `is_verified`, `avatar_url`, `activity_region`, `gender`, `handedness`) — no `privacy_settings`, raw verification, status, email, etc. | **PASS** |
| 9 | No hidden-player count / total leak | `no hidden total leak in meta` — meta keys observed: `nextCursor`, `limit`, `count` only | **PASS** |
| 10 | Invalid cursor controlled | `invalid cursor is controlled` — `code: INVALID_CURSOR` | **PASS** |
| 11 | Nonexistent detail safe | `nonexistent detail is null` | **PASS** |
| 12 | No exclusion reason / private status leak | Ineligible details return null only (no hide-reason / status / verification string in detail payload) | **PASS** |
| 13 | Evidence sanitized | Reports contain no passwords, JWTs, service-role keys, DB URLs, or auth headers; Staging ref + QA emails / player_ids only | **PASS** |
| 14 | Temporary fixtures cleaned | CLEANUP `after.rows: []`; remaining count **0** | **PASS** |

Overall live verify envelope: `ok: true`, `failed: []` (15 checks).

---

## 6. Sanitized sample excerpts (non-secret)

### Eligible detail (fields shown)

```json
{
  "player_id": "qa-pm1ja-eligible",
  "display_name": "PM1JA Eligible Public Athlete",
  "gender": "female",
  "handedness": "right",
  "activity_region": "Hà Nội, Cầu Giấy, VN"
}
```

### Masked detail (privacy flags off → nulls)

```json
{
  "player_id": "qa-pm1ja-masked",
  "display_name": "PM1JA Masked Privacy Athlete",
  "is_verified": true,
  "avatar_url": "https://cdn.example/pm1ja-avatar.png",
  "gender": null,
  "handedness": null,
  "activity_region": null
}
```

### Meta (page-only count; no hidden total)

```json
{
  "nextCursor": null,
  "limit": 50,
  "count": 2
}
```

(`count` = page result size for the browse call that returned eligible + masked; not a hidden-population total.)

### Invalid cursor

```json
{ "code": "INVALID_CURSOR" }
```

---

## 7. Environment and safety

| Action | This phase |
|--------|------------|
| Staging reads (new) | **Not performed** — reuse merged 1J-A verify |
| Staging writes | **Not performed** |
| Production access | **Not performed** |
| SQL apply | **Not performed** |
| Deploy | **Not performed** |
| Runtime / UI / DTO / SQL file changes | **None** |
| Secrets committed | **None** |

Staging ref confirmed in cited reports: `qyewbxjsiiyufanzcjcq`.

---

## 8. Defects

No privacy, masking, search, cursor, detail, or exclusion defect was identified in the cited live evidence.

---

## 9. Residual notes

1. Fixtures were cleaned after 1J-A capture; Staging currently has **zero** remaining `qa-pm1ja-*` profiles per cleanup report. Re-verification would require a **separate** Owner Staging write authorize + re-seed.
2. Production browser matrix remains **1J-C** (separate token).
3. Empty eligible directory remains a valid product state when fixtures are absent (freeze §3.1 / exit criteria).

---

## 10. Owner action next

1. Review this package + `STAGING_PM1JB_PRIVACY_CERTIFICATION.json`.
2. Authorize commit on `feature/player-phase-1j-b-staging-privacy-evidence`.
3. After merge, authorize **1J-C** Production read-only browser smoke when ready (`AUTHORIZE_PHASE_1J_PRODUCTION_BROWSER_SMOKE`).
