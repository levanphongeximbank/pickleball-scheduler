# Phase 1G — Formal Closure Evidence

**Final verdict:** `PHASE_1G_CLOSED`  
**Owner decision:** `CLOSE_PHASE_1G_NOW`  
**Closure date:** 2026-07-20 (UTC+7)  
**Docs branch (this package):** `docs/player-phase-1g-closure`  
**origin/main SHA at closure authoring:** `288f601775c7284a5ec7808d3c84baf1f6973872`  
**1G-A merge on main:** PR #101 (`288f601`)

---

## 1. Frozen Phase 1G scope

| Field | Value |
|-------|--------|
| Scope freeze | `00_PHASE_1G_SCOPE_FREEZE.md` — Owner `APPROVE_PHASE_1G_SCOPE` |
| Classification | **A — Self Profile Foundation Edit UI Completion** |
| In scope | Athlete self foundation edit (1G-A): `birth_date`, synchronized `birth_year`, `handedness`, `activity_region`, `privacy_settings` |
| Optional | 1G-B My Profile parity + stale field-list cleanup |
| Deferred | 1G-C verification admin (was 1F-C); 1G-D legacy dossier/blob cutover (was 1F-D); 1G-E public directory UI (was 1F-B3) |
| Schema / Production | **No** new Production schema migration; **no** SQL apply; **no** deploy |

Hard rules preserved:

1. Save only via `updateSelfProfile` → `updateAuthenticatedSelfPlayerProfile` → `updatePlayerProfile`.
2. Do not rewrite Club / Competition / Ranking / Rating / Venue / Notification in the same wave.
3. Do not expand into C / D / E without Owner `REVISE_SCOPE`.

### Base and closure SHAs

| Milestone | SHA |
|-----------|-----|
| Phase 1G base (`origin/main` at branch cut) | `8f11ed3716f1eb338d93112b45fe6276f1f61d89` |
| Phase 1G implementation present on `main` | `288f601775c7284a5ec7808d3c84baf1f6973872` |

---

## 2. Sub-phase outcomes

| Sub-phase | Outcome | Evidence |
|-----------|---------|----------|
| **1G-A** | **Closed** — Athlete `/player/profile` foundation **edit** UI | `03_PHASE_1G_A_IMPLEMENTATION_EVIDENCE.md` |
| **1G-B** | **Excluded** (optional) — not required for closure | Owner `CLOSE_PHASE_1G_NOW` |
| **1G-C** | **Deferred** | Out of scope (was 1F-C) |
| **1G-D** | **Deferred** | Out of scope (was 1F-D) |
| **1G-E** | **Deferred** | Out of scope (was 1F-B3) |

### 1G-A outcome

- Athlete surface: `/player/profile` (`AthleteSelfProfilePage`).
- Editable foundation fields:
  - `birth_date`
  - synchronized `birth_year`
  - `handedness`
  - `activity_region`
  - `privacy_settings`
- Canonical write path only (no direct Supabase profile write).
- Reload via `useAuthenticatedSelfPlayerProfile` after save.
- `identity_verification_status` remains read-only on self.

### 1G-B decision

**Not required.** Frozen scope marked 1G-B optional. Implementation intentionally excluded My Profile parity to keep the wave isolated. Owner closed Phase 1G without 1G-B.

### C / D / E deferred boundary

| Item | Status |
|------|--------|
| Identity verification admin / privileged RPC UI | **Deferred (1G-C / was 1F-C)** |
| Full `PlayerProfile.jsx` / V2 dossier cutover | **Deferred (1G-D / was 1F-D)** |
| Club blob / AI session player write retirement | **Deferred (1G-D / was 1F-D)** |
| Public Player directory UI | **Deferred (1G-E / was 1F-B3)** |

No work begins on deferred items without Owner `REVISE_SCOPE`.

---

## 3. Canonical contracts (closed state)

### Self foundation write path

```
AthleteSelfProfilePage
  → updateSelfProfile (Identity bridge)
  → updateAuthenticatedSelfPlayerProfile
  → updatePlayerProfile
  → durable profiles repository (session JWT + RLS)
```

### Birth date / year rule

1. `birth_date` is authoritative when present.
2. `birth_year` is derived from `birth_date` when date is set.
3. No `birth_date` is invented from a year-only value.
4. Contradictory date/year values are rejected (client helper + durable `normalizeAndValidateWritePatch`).

Documented in: `src/features/player/utils/selfFoundationForm.js`.

### Privacy behavior

| Item | Contract |
|------|----------|
| Keys | Existing privacy SSOT only (`constants/privacy.js`) |
| Public / directory | Fail-closed projector from Phase 1F-B remains unchanged |
| Raw `privacy_settings` | Never exposed through public/directory projection |

### Verification protection

| Control | Result |
|---------|--------|
| UI | `identity_verification_status` read-only (“chỉ xem”); no edit control |
| Form helper | `stripVerificationFromSelfPatch` removes forbidden input |
| Durable path | `updatePlayerProfile` returns `FORBIDDEN_FIELD` for verification keys |
| DB | Existing Phase 1E guard remains; no SQL change in Phase 1G |

---

## 4. Test evidence (closure audit on main `288f601`)

| Suite | Result |
|-------|--------|
| Focused Phase 1G-A | **18/18 PASS** |
| All `tests/player-management*.test.js` | **161/161 PASS** |
| Relevant UI / Vitest (1G-A + 1F-A smoke) | **8/8 PASS** |

Primary test files:

- `tests/player-management-phase-1g-a-self-profile-edit.test.js`
- `tests/ui/player-phase-1g-a-self-profile-edit.smoke.test.jsx`
- Regression includes Phase 1F-A / 1F-B1 / 1F-B2 suites

---

## 5. Production / SQL / deploy boundary

| Check | Result |
|-------|--------|
| New Production schema SQL for Phase 1G | **No** |
| Production SQL applied | **No** |
| Production data mutated | **No** |
| Frontend / Vercel deployment for Phase 1G | **No** |
| Club / Competition / Ranking / Rating / Venue / Notification ownership bleed | **No** |

Phase 1E Production foundation columns remained the schema baseline; Phase 1G consumed them in app UI only.

---

## 6. Final verdict

**`PHASE_1G_CLOSED`**

Phase 1G frozen scope (classification **A** — Self Profile Foundation Edit UI Completion) is complete on `main` at `288f601`. Optional 1G-B was intentionally excluded. 1G-C / 1G-D / 1G-E remain deferred pending separate Owner scope decisions.

---

## 7. Next-phase boundary

Phase 1G is **closed**. Do **not** treat the following as open Phase 1G work:

1. **1G-B** My Profile parity — only if a later Owner product gate requires it.
2. **1G-C** — identity verification admin workflow / privileged RPC UI.
3. **1G-D** — legacy writer cutover, link/dedupe, full V2 dossier migration, club blob write retirement.
4. **1G-E** — public Player directory UI (projector-backed).
5. Any Production SQL apply or deploy — requires a **separate** Owner gate.

Suggested next Owner choice (outside this closure): open a **new** discovery and scope freeze for any future Player Management capability — do not reopen Phase 1G.
