# 07 — Security, Permissions, and Privacy Requirements

**Phase:** 1A — Architecture and Contract Freeze
**Status:** Requirements documentation only
**RLS / RPC / SQL / Supabase edits:** Forbidden in Phase 1A

---

## 1. Permission requirements (frozen)

| Operation | Who may initiate | Authority rule |
|-----------|------------------|----------------|
| Self-assessment | The player | May initiate self-assessment input only |
| Verification | Authorized **server-side** actor | Required — never client-authoritative |
| Manual adjustment | Authorized **server-side** actor | Required — never client-authoritative |
| Result-to-rating apply / reverse | Authorized server-side Player Rating processing | Via ports; not client upsert |

---

## 2. Adjustment audit requirements

Every manual adjustment audit record must capture at least:

| Field | Requirement |
|-------|-------------|
| Actor | Authenticated authorized actor id |
| Reason | Non-empty reason |
| Before state | Relevant rating state before adjustment |
| After state | Relevant rating state after adjustment |
| Timestamp | Server time |
| Scope | Tenant / rating_mode / competition scope as applicable |
| Correlation ID | Links to command / event / request |

Port: `RatingAdjustmentAuditPort` (interface only in Phase 1A).

---

## 3. Trust boundaries

1. **Client-provided verified values must not be trusted as authoritative.**
2. **No client RPC may become authoritative merely because it can upsert fields.**
3. Calculated rating, confidence, deviation, and evidence are server-derived or server-gated.
4. Display projection must not accept client overrides of verified/calculated fields.

### Evidence (read-only)

| Concern | Path | Symbol | Classification |
|---------|------|--------|----------------|
| Forbidden client rating fields | `src/features/pick-vn-rating-v5/security/forbiddenClientFields.js` | `FORBIDDEN_CLIENT_RATING_FIELDS` | `CODE_PRESENT` |
| Server-authoritative ADR | `docs/v5/rating-v5/adr/ADR-001-server-authoritative-rating.md` | ADR-001 | Accepted decision doc; Production cutover `PRODUCTION_STATUS_UNVERIFIED` |
| V2 client trust risk | ADR-001 notes `pick_vn_sync_rating` accepts verified fields from clients | Legacy path | `LEGACY_FALLBACK` / open hardening gate |
| Permission matrix docs | `docs/v5/rating-v5/V5-A_PERMISSION_MATRIX.md` | matrix | Docs; runtime `PRODUCTION_STATUS_UNVERIFIED` |

Phase 1A does **not** edit RLS policies. Existing V5 SQL drafts describe deny-direct-write patterns (`DATABASE_DRAFT` / `STAGING_EVIDENCE_PRESENT` under rating-v5 QA evidence). Those artifacts are evidence of intent, not a Phase 1A schema change.

---

## 4. Privacy requirements

| Data class | Default exposure |
|------------|------------------|
| Public display rating projection | May be exposed under Player / privacy policy |
| Internal confidence | **Not** publicly exposed by default |
| Deviation / reliability internals | **Not** publicly exposed by default |
| Evidence artifacts / review notes | Restricted / internal |
| Adjustment reasons | Restricted / internal |
| Algorithm internals | Restricted / internal |

---

## 5. Tenant and venue isolation

1. Tenant resolution must **fail closed**.
2. Venue resolution, when required by policy, must **fail closed**.
3. Cross-tenant rating reads/writes are forbidden.
4. Ambiguous tenant/venue context must not default to “open”.

---

## 6. Cross-module write prohibitions

| Module | May write Player Rating values? |
|--------|----------------------------------|
| Ranking | **No** |
| Player Management | **No** |
| Club Management | **No** |
| Competition Engine | **No** direct rating writes — emits match-result dependency events only |
| Identity | **No** |

---

## 7. Non-goals

* Editing RLS policies, RPCs, SQL, or Supabase configuration
* Implementing permission middleware
* Changing Identity RBAC matrices
* Claiming Production RLS is complete without separate verification

---

## 8. Freeze statement

Security, permission, privacy, and isolation requirements above are frozen as Player Rating Phase 1A contracts. Enforcement implementation is out of scope for this phase.
