# 07 — Runtime and Filter Migration Map

## Inventory method

Repository review (planning base `3c6c3f02`) of quarantine-related runtime signals, QA exclusion, Auth ban, suspension, and profile status consumers. No Staging/Production queries performed.

## Existing `status === 'quarantined'` consumers

| Location | Role | Classification |
|----------|------|----------------|
| `src/features/player/utils/qaTestIdentityFilter.js` | Treats `status==='quarantined'` as confirmed QA identity | **MIGRATE** — primary runtime hook |
| `scripts/operations/production-qa-identity-operation-b1/lib/quarantineEngine.js` | Writes/expects status quarantined | **REPLACE** in B1B runner |
| `scripts/operations/production-qa-identity-operation-b1/lib/constants.js` | `QUARANTINE_PROFILE_STATUS` | **REPLACE** |
| `scripts/operations/production-qa-identity-operation-b1/lib/liveOperator/createLiveAdapters.js` | `updateProfileStatus` | **REPLACE** writer |
| B1 docs under `docs/v5/operations/production-qa-identity-operation-b1/` | Package assumes status quarantine | **SUPERSEDED** by B1B plan (do not edit in this planning task) |
| `docs/v5/migrations/PRODUCTION_TEST_IDENTITY_QUARANTINE_PLAN.sql` | Planning note | **SUPERSEDED** conceptually |
| B1 unit/live-runner tests | Mock status quarantined | **REWRITE** under WP5 |
| Gender remediation QA evidence docs | Historical plan text | **NO RUNTIME CHANGE** — historical |

## Existing `qaQuarantined` / `quarantined` boolean consumers

| Location | Role | Classification |
|----------|------|----------------|
| `qaTestIdentityFilter.js` — `identity.quarantined === true` | Hide identity | **KEEP** as compatibility input |
| `qaTestIdentityFilter.js` — `identity.meta?.qaQuarantined === true` | Hide identity | **KEEP** temporary; projector may set |
| No durable `profiles.meta.qaQuarantined` column found | N/A | **NOT SSOT** |

## Test identity exclusion / QA email domains

| Location | Role |
|----------|------|
| `APPROVED_QA_EMAIL_DOMAINS` / `isCertifiedQaEmail` in `qaTestIdentityFilter.js` | Positive classification requires approved domain + certified local-part |
| `excludeQaTestIdentities` | Directory hide helper |
| `src/pages/Players.jsx` | Uses `excludeQaTestIdentities` on player load |
| B1 `allowlist.js` / `eligibility.js` | Import certified email predicate |

These remain; quarantine authority becomes an additional **confirmed** signal, not a replacement for email certification on allowlist generation.

## Auth ban state

| Location | Role |
|----------|------|
| B1 eligibility / adapters | Read `banned_until`; ban/unban via Admin API |
| `scripts/lib/prod-smoke-identity-hygiene.mjs` (referenced) | Pattern source for ban duration |
| Identity reset-password Admin API | Unrelated Auth admin usage |

B1B retains Auth ban as complementary control **after** authority write.

## Account suspension / inactivity / archived-deleted

| Signal | Store | Relation to QA quarantine |
|--------|-------|---------------------------|
| Account suspension | `profiles.status='suspended'` | **Distinct** — must not be reused |
| Invited | `profiles.status='invited'` | Distinct |
| Athlete inactive/archived | athletes / blob player status | Distinct |
| Membership removed/left | `club_members.status` | Distinct (B2 territory) |
| Privacy hide | `privacy_settings.publicProfileEnabled` | Distinct — not quarantine |
| Hard delete | Auth/profile delete | **Forbidden** for B1B |

## Writers and guards that can modify related state

| Writer / guard | Can touch | B1B rule |
|----------------|-----------|----------|
| `identity_admin_update_user` | `profiles.status` active/suspended/invited | Must not be used for QA quarantine |
| `profiles_guard_privileged_update` | Blocks self status changes | Keep |
| Player profile write repos | Profile fields; not quarantine authority | Keep boundary |
| B1A `updateProfileStatus` | profiles.status | **Remove from quarantine path** |
| Auth Admin ban | Auth ban state | Keep after authority insert |
| Future `qa_quarantine_apply/release` | Authority table | **Canonical** |

## Compatibility mapping

| Legacy signal | Temporary dual-read | Final canonical read |
|---------------|---------------------|----------------------|
| `status === 'quarantined'` | Still treated as confirmed QA if ever present historically | Stop relying; optional warn/metric if seen (should be zero rows) |
| `meta.qaQuarantined === true` | Accepted | Prefer projector from authority; deprecate unstructured meta as SSOT |
| `quarantined === true` | Accepted | Projector sets from authority |
| Active row in `qa_identity_quarantines` | Accepted (new) | **Canonical** |
| Certified QA email alone | Still hides in `excludeQaTestIdentities` | Remains defense-in-depth for directory hygiene |

## Migration sequence (runtime)

1. **WP1/WP2:** Schema + RPC land (no Production GO)
2. **WP3a:** Add read helper/projector `isQaIdentityQuarantined(profileId|row)`
3. **WP3b:** Update `isConfirmedQaTestIdentity` to check authority/projector **first**, keep legacy checks
4. **WP3c:** Ensure Players directory and any other list surfaces use updated helper
5. **WP4:** Runner writes authority only (no status mutation)
6. **WP5:** Tests prove legacy status path unused for writes; dual-read still hides correctly
7. **WP6:** Staging smoke
8. **Later cleanup:** Remove legacy `status==='quarantined'` write assumptions from ops scripts; keep read fallback until evidence shows zero legacy dependency

## Temporary compatibility behavior

During dual-read window:

```text
isConfirmedQaTestIdentity =
  activeQuarantineAuthority
  OR quarantined flag
  OR meta.qaQuarantined
  OR status === 'quarantined'   -- legacy read only
  OR isCertifiedQaEmail(email)
```

Must never persist `status='quarantined'`.

## Final canonical read behavior

```text
isQaQuarantined = exists active qa_identity_quarantines for profile_id
isConfirmedQaTestIdentity = isQaQuarantined OR isCertifiedQaEmail(email) [and any product-approved flags]
```

Product may choose to keep certified-email exclusion even without quarantine row (directory hygiene). Quarantine authority remains the ops SSOT for “quarantined by Operation B1B”.

## Removal of legacy assumptions

Remove/replace in B1B implementation packages:

- `QUARANTINE_PROFILE_STATUS = 'quarantined'` as write target
- Engine step “update profile status then ban”
- Docs stating quarantined is canonical profiles.status value
- Tests that assert profile status becomes `quarantined`

## UI behavior

- User-facing directories: continue excluding confirmed QA identities
- Admin identity UI: show account status unchanged (`active` etc.); optional ops badge “QA quarantined” from authority read RPC (SUPER_ADMIN)
- Do not display illegal status strings

## Directory filtering

- `Players.jsx` path remains `excludeQaTestIdentities`
- Future directory RPCs (Phase 1I) should exclude suspended accounts as today and additionally exclude active QA quarantines if lists can include QA emails

## Authentication behavior

- Quarantine does not require `profiles.status` change
- Auth ban prevents login when applied
- Suspended real users continue to use existing auth/RBAC denial paths

## Business-reference behavior

- B1 eligibility already requires zero business refs for exact-eight
- Quarantine authority does not delete refs
- Real users never enter allowlist ⇒ no-impact proof

## No-impact proof for real users

Implementation acceptance must show:

1. Non-allowlisted profiles never receive authority rows in rehearsal
2. `profiles.status` distribution for non-targets unchanged
3. Real-user lookalike `phase1b-smith@gmail.com` rejected by certified email predicate
4. Suspended real users still governed solely by `profiles.status='suspended'`
5. No RLS change weakens tenant isolation on `profiles`
