# 03 — Option C Decision Record

**Decision:** Select **C2 — Dedicated authority table `public.qa_identity_quarantines`**  
**Date (planning):** 2026-08-06  
**`profiles.status` preservation:** REQUIRED  
**`profiles_status_check` change:** NOT REQUIRED (and rejected)

## Options evaluated

### C1 — Dedicated columns on `public.profiles`

Possible model: `qa_quarantined`, `qa_quarantined_at`, `qa_quarantined_by`, `qa_quarantine_reason`, `qa_quarantine_batch_id`.

| Dimension | Assessment |
|-----------|------------|
| Advantages | Simple reads co-located with profile; easy join-free filter; maps somewhat to existing `qaQuarantined` boolean mental model |
| Disadvantages | Couples ops quarantine to the hottest identity table; weak natural history (overwrite vs append); release/history awkward without secondary log; increases profiles ALTER blast radius; mixes lifecycle columns with ops control |
| Schema blast radius | Medium — ALTER `profiles` + indexes + RLS/policy review on heavily guarded table |
| Runtime blast radius | Medium — many profile mappers may need ignore/passthrough; accidental UI exposure risk |
| RLS implications | Must extend `profiles` policies/triggers already blocking status/role self-writes; easy to get wrong |
| Auditability | Weak unless separate audit rows; column overwrite loses prior quarantine events |
| Rollback | Column clear is possible but loses forensic history unless mirrored elsewhere |

### C2 — Dedicated authority table `public.qa_identity_quarantines`

| Dimension | Assessment |
|-----------|------------|
| Advantages | Clean semantic separation; append+release history; batch correlation; exact bind constraints; isolated RLS; no change to `profiles.status` CHECK; reversible and idempotent by design |
| Disadvantages | Extra join/lookup for directory filters; new RPC/writer surface; slightly more migration objects |
| Schema blast radius | Medium-low — new table + RLS + RPCs; **zero** change to `profiles_status_check` |
| Runtime blast radius | Medium — filter/projector migration required, but localized; profiles lifecycle readers unchanged |
| RLS implications | Contained on new table; deny-by-default; service-role / SUPER_ADMIN writers only |
| Auditability | Strong — row history, actors, reasons, batch ids, release trail |
| Rollback | Deterministic batch-scoped release + Auth restore from snapshots |

### C3 — Canonical use of existing metadata / JSONB

Candidates reviewed:

- `profiles.privacy_settings` (Phase 1C) — privacy fail-closed object, not ops quarantine
- Runtime-only `meta.qaQuarantined` / `quarantined` boolean — **not** durable DB columns on `profiles`
- No committed general-purpose `profiles.meta` quarantine authority with CHECKs, indexes, and writer guards suitable for Production quarantine

| Dimension | Assessment |
|-----------|------------|
| Advantages | Seemingly few schema files if a JSON key were overloaded |
| Disadvantages | Weak constraints; poor indexing for “active quarantine inventory”; easy self-write confusion; pollutes privacy semantics; weak uniqueness/idempotency; weak batch correlation; weak RLS field-level control |
| Schema blast radius | Low schema LOC, **high semantic risk** |
| Runtime blast radius | High ambiguity across mappers |
| RLS implications | JSON keys hard to lock down vs columns/table |
| Auditability | Poor |
| Rollback | Ambiguous and drift-prone |

**C3 is rejected** — existing schema does **not** provide a safe, enforceable dedicated quarantine authority.

## Comparative scorecard (required properties)

| Property | C1 | C2 | C3 |
|----------|----|----|----|
| Semantic separation from real account lifecycle | Partial | **Strong** | Weak |
| Preserve `profiles.status` semantics | Yes (if unused) | **Yes** | Yes (if unused) |
| Reversibility | Medium | **Strong** | Weak |
| Idempotency | Medium | **Strong** | Weak |
| Exact profile + Auth binding | Medium | **Strong** | Weak |
| Prevent arbitrary self-service writes | Medium (profiles RLS) | **Strong** | Weak |
| SUPER_ADMIN / service-role clarity | Medium | **Strong** | Weak |
| Tenant isolation | Medium | **Strong** | Weak |
| RLS complexity | Higher on profiles | Contained | Deceptively low / unsafe |
| Writer complexity | Medium | Medium | High (ad-hoc) |
| Runtime read cost | Lowest | Low (indexed lookup/view) | Variable |
| Indexing | OK | **Best** | Poor |
| Compat with `qaQuarantined` hooks | Good | Good via projector | Accidental |
| Compat with `status==='quarantined'` filters | Needs remap | Needs remap | Needs remap |
| Auditability | Weak | **Strong** | Weak |
| Rollback / drift / batch correlation | Medium | **Strong** | Weak |
| Real-user protection | Medium | **Strong** | Weak |
| Staging rehearsal clarity | Medium | **Strong** | Weak |
| Implementation blast radius | Medium-high on profiles | **Controlled** | Semantic high |
| Future cleanup/removal | Harder (columns linger) | Drop table/RPCs cleanly | Messy JSON leftovers |
| Accidental real-user impact | Medium | **Lowest** | Highest ambiguity |

## Final decision

**Canonical selection: C2 — `public.qa_identity_quarantines`.**

Selected because quarantine is an operations authority with history, batch binding, release semantics, and strict writer controls — not a profile lifecycle value and not a privacy JSON key.

## Rejected alternatives

| Option | Reason rejected |
|--------|-----------------|
| C1 columns on `profiles` | Higher profiles blast radius; weak history; couples ops flag to identity SSOT; harder clean removal |
| C3 metadata/JSONB | No suitable enforceable committed authority; weak constraints/audit/RLS; unsafe for Production quarantine |
| Extend `profiles_status_check` with `quarantined` | Global lifecycle pollution; ~208 status consumers risk; medium-high blast radius; conflates QA ops with account states |
| Reuse `suspended` | Overloads real-user account lock semantics; breaks product meaning of suspension; unacceptable |

## Explicit: why `suspended` must not be reused

From Player Management lifecycle contract (`docs/player-management/phase-1a/04_STATUS_AND_LIFECYCLE_MODEL.md`):

- `suspended` means **account blocked at auth/identity layer for real account lifecycle**
- QA quarantine means **hide/disable certified test identities for Production hygiene**

Using `suspended` for QA would:

- Make real admin “unsuspend” flows accidentally revive QA identities (or block real users mistaken as QA)
- Poison analytics, RBAC helpers (`p.status = 'active'`), and support runbooks
- Destroy semantic separation required by Phase 1A

## Explicit: why `profiles.status` must remain unchanged

1. CHECK contract is `active | suspended | invited` in canonical SQL and live Production (B1 incident proof).
2. Extending CHECK has medium-high global blast radius across identity, directory, RLS helpers, and ~208 repository consumers of profile status semantics.
3. QA quarantine is not an account lifecycle state.
4. B1B success criterion includes **zero dependency** on illegal status values.
5. Runtime filters that check `status === 'quarantined'` are **legacy assumptions** to be remapped — not schema justification.

## Compatibility mandate (post-decision)

Regardless of C2 selection, implementation must define:

- Compatibility handling for `status === 'quarantined'` readers (treat as legacy; prefer active quarantine authority / projector)
- Compatibility handling for `meta.qaQuarantined` / `quarantined` boolean hooks
- Proof that real-user `profiles.status` paths remain behaviorally unchanged
