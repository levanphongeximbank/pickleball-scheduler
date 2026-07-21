# Phase 1I-F — Final Closure and Certification

**Owner decision:** `AUTHORIZE_PHASE_1I_F_CLOSURE`
**Branch:** `docs/player-phase-1i-f-closure`
**Base:** `origin/main` @ `49d5a53b14b0b8bf40958caa574b1ee78b2dd048` (merge of PR #125)
**Document verdict:** `READY_FOR_PHASE_1I_F_PRECOMMIT_REVIEW`

---

## 1. Executive verdict

Player Management **Phase 1I — Authenticated Public Player Directory** is **complete** on `main` for the approved platform MVP scope:

| Surface | Status |
|---------|--------|
| Application contract (1I-A) | Merged |
| SQL read-model Staging (1I-B / 1I-BS) | Merged + Staging-applied under prior Owner gates |
| List UI `/athletes` (1I-C) | Merged |
| Detail UI `/athletes/:playerId` (1I-D) | Merged |
| QA / hardening / CI remediation (1I-E) | Merged (PR #125) |
| Closure / certification (1I-F) | This package — docs/audit only |

**Phase 1I does not authorize Production deploy.** Production remains a separate Owner gate after 1I-F commit/merge.

**Completion percentage (Phase 1I scope):** **100%** of locked sub-phases 1I-0 → 1I-F (documentation closure). Runtime Product MVP for authenticated directory is delivered on Staging-backed contracts; Production rollout is explicitly out of scope for this closure document.

---

## 2. Phase inventory

| Sub-phase | Objective | Package / evidence | Status on `main` |
|-----------|-----------|--------------------|------------------|
| **1I-0** | Read-model design | `05`–`09` design docs (historical) | Merged (PR #114) |
| **1I-A** | Facade / repository contract | `searchPublicDirectoryPlayers`, `getPublicDirectoryPlayer` | Merged (PR #116) |
| **1I-B** | SQL authoring | `docs/v5/PHASE_1I_B_*` + `phase-1i-b-sql/` | Merged (PR #118) |
| **1I-BS** | Staging apply / rollout docs | Staging apply under separate Owner tokens | Contained via 1I-B lineage |
| **1I-C** | List UI | `07_PHASE_1I_C_DIRECTORY_LIST_UI.md` | Merged (PR #121) |
| **1I-D** | Detail UI | `08_PHASE_1I_D_DIRECTORY_DETAIL_UI.md` | Merged (PR #122) |
| **1I-E** | QA + hardening + CI fix | `09_PHASE_1I_E_QA_HARDENING.md` | Merged (PR #125) |
| **1I-F** | Closure | This document | In progress (docs branch) |

---

## 3. Merged PR inventory

| PR | Subject | Merge commit on `main` |
|----|---------|------------------------|
| #112 | Phase 1I scope freeze | Contained in lineage before 1I-0 |
| #114 | 1I-0 read-model design | `5a6a2a4` merge ancestry |
| #116 | 1I-A directory contract | `1ef9c75` |
| #118 | 1I-B directory SQL | `2034061` |
| #121 | 1I-C list UI | `cab184d` |
| #122 | 1I-D detail UI | `a5563b2` |
| #125 | 1I-E QA / hardening / CI remediation | `49d5a53` |

---

## 4. Commit containment evidence

Recorded against `origin/main` during 1I-F baseline (`49d5a53`):

| Artifact | SHA | Contained in `origin/main` |
|----------|-----|----------------------------|
| Phase 1I-E tip (CI remediation) | `2acd2cc57501761f127875247fe4e2d872066b89` | Yes |
| Phase 1I-D feature tip | `0d462996859bd66619d25742bb43f546474ae246` | Yes |
| Phase 1I-C feature tip | `5b23b0daf84be3b06b24b9e598f1e2b9b7d3d1cb` | Yes |
| 1I-D merge | `a5563b23142c434d6f5ac64c568b9a4f443c2feb` | Yes |
| 1I-C merge | `cab184d3d96f5426eb13a89f1ab07419c18cda3d` | Yes |
| 1I-E merge (PR #125) | `49d5a53b14b0b8bf40958caa574b1ee78b2dd048` | Yes (= HEAD) |

No open Player Management Phase 1I feature branch retains required unmerged work relative to `origin/main` (feature tips are ancestors of `main`).

---

## 5. Final architecture

```
UI (/athletes, /athletes/:playerId)
  → list/detail controllers
    → searchPublicDirectoryPlayers / getPublicDirectoryPlayer (1I-A facade)
      → playerDirectoryRepository → SECURITY DEFINER RPCs (1I-B)
        → player_directory_search / player_directory_get
```

- React never calls Supabase RPC directly for this surface.
- Strict Directory DTO projection is application-enforced (defense in depth on top of RPC masking).
- Auth: MainLayout + `isAuthenticatedOnlyRoute("/athletes" | "/athletes/…")`.

---

## 6. Route contract

| Route | Shell | Auth | Permission |
|-------|-------|------|------------|
| `/athletes` | `MainLayout` | Authenticated-only | None (`ROUTE_PERMISSIONS[]`) |
| `/athletes/:playerId` | `MainLayout` | Authenticated-only (prefix) | None |
| Unauthenticated | — | Login redirect when auth production / RBAC requires auth | — |
| Anonymous `PublicLayout` directory | — | **Not** implemented | — |

Does not conflict with `/players` or `/players/profile/:playerId`.

---

## 7. Public DTO contract

Approved fields only:

| Field | Type |
|-------|------|
| `playerId` | `string` |
| `displayName` | `string` |
| `isVerified` | `true` (directory eligibility) |
| `avatarUrl` | `string \| null` |
| `activityRegion` | `string \| null` |
| `gender` | `string \| null` |
| `handedness` | `string \| null` |

`playerId` is used for routing; not shown as visible UI text.

---

## 8. Privacy contract

- Detail null results for nonexistent / privacy-hidden / ineligible / suspended remain **indistinguishable**.
- Generic message (locked):
  `Không tìm thấy vận động viên hoặc hồ sơ này hiện không được công khai.`
- No email, phone, auth user id, privacy settings, raw verification status, account status, birth date/year, rating, ranking, tenant/venue/club ids, roles, audit, moderation, suspension/eligibility reasons.
- No total profile count or inferred hidden count in UI.
- No direct `.rpc(` / `player_directory_*` from React directory components.

---

## 9. Navigation contract

| Rule | Result |
|------|--------|
| Directory discoverable exactly once (PLAYER) | PASS |
| Directory discoverable exactly once (authenticated non-PLAYER) | PASS |
| PROFILE leaf excludes PLAYER (`excludeRoles`) | PASS |
| RBAC-off still enforces roles/excludeRoles for dual-entry dedupe | PASS |
| RBAC-on preserves club-nav override before excludeRoles | PASS (CI remediation `2acd2cc`) |
| Club president retains “Vận hành CLB” | PASS (Phase 42L) |
| Sidebar / mobile parity | PASS (Phase 42L) |

---

## 10. QA and regression evidence

Deterministic suites (re-run during 1I-F closure validation):

| Suite | Role |
|-------|------|
| `tests/player-management-phase-1i-c-directory-list-ui.test.js` | List UI / cursor / search |
| `tests/player-management-phase-1i-d-directory-detail-ui.test.js` | Detail UI / privacy not-found |
| `tests/player-management-phase-1i-e-directory-qa-hardening.test.js` | QA matrix / nav once |
| `tests/player-management-phase-1i-a-directory-contract.test.js` | Facade / DTO |
| `tests/phase42l-navigation-matrix.test.js` | Club nav + president + parity |
| Auth / RBAC / app-shell | Route guards + menu |
| Full unit-test gate | Repository CI registration |

1I-E CI remediation: Production CI Gate failure on Phase 42L president “Vận hành CLB” was fixed by narrowing RBAC-off role gating without weakening directory dedupe (`2acd2cc`).

---

## 11. Staging evidence summary

| Item | Value |
|------|--------|
| Staging project | `qyewbxjsiiyufanzcjcq` |
| Forbidden Production | `expuvcohlcjzvrrauvud` |
| 1I-E smoke | `scripts/smoke-player-directory-staging-1i-e.mjs` — `RAN_READ_ONLY` |
| Search | ok; itemCount `0` (fixture limitation — no eligible public rows) |
| Nonexistent detail | ok; player null |
| Mutations | none |
| Credentials | gitignored local env only — not committed |

Empty Staging directory results are a **data limitation**, not positive-row privacy proof. Deterministic unit tests remain the primary privacy/contract evidence.

---

## 12. Production safety confirmation

| Check | Result |
|-------|--------|
| Production project used as active target during 1I | No |
| Production deploy authorized by Phase 1I | No |
| Browser service-role | Forbidden / not introduced |
| Secrets in committed Phase 1I packages | None |

---

## 13. SQL / migration confirmation

Phase 1I-F closure makes **no** SQL or migration changes.

Executable SQL remains the 1I-B package under prior Owner Staging apply tokens. Production SQL apply is **not** authorized by 1I-F.

---

## 14. Deployment confirmation

| Action | Status |
|--------|--------|
| Vercel / Netlify Production deploy | Not performed by 1I-F |
| Preview deploys from historical PRs | Owner-controlled; not part of closure runtime change |
| Feature flags for anonymous directory | Not enabled |

---

## 15. Known limitations

1. Staging public directory may have **zero eligible** verified public rows (observed in 1I-E smoke).
2. Anonymous / hybrid PublicLayout directory remains **out of scope**.
3. No biography, match history, rating, club membership, social, or contact actions on public directory surfaces.
4. Abuse-rate limits are RPC/backend-owned; UI does not invent client-side quota counters.
5. Production rollout of directory SQL / env is a **separate** Owner gate after 1I-F.

---

## 16. Residual risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Staging empty-set limits live privacy sampling | Low | Unit contract tests + future seeded Staging fixtures under Owner authorize |
| RBAC-off vs RBAC-on menu semantics drift | Low | Covered by 1I-E + Phase 42L + CI remediation |
| Production apply without checklist | Medium | Hold Production until separate Owner Production gate |
| Future menu dual-entry for other features | Low | Prefer explicit `roles`/`excludeRoles` + group visibility patterns |

---

## 17. Operational handoff

1. Keep facade-only access for directory UI (no React RPC).
2. Any Staging fixture seeding for eligible public athletes requires separate Owner authorize (no mutation under 1I-F).
3. Production: use existing Production checklists; do not treat 1I-F merge as deploy authority.
4. Monitor `/athletes` and `/athletes/:playerId` behind normal auth production flags.

---

## 18. Closure criteria

| Criterion | Met |
|-----------|-----|
| 1I-A → 1I-E merged to `main` | Yes |
| PR #125 merged; `2acd2cc` contained | Yes |
| Final route / DTO / privacy / nav contracts documented | Yes |
| Deterministic regressions green at closure validation | Yes (see return report) |
| No runtime changes in 1I-F | Yes |
| No Production deploy | Yes |
| Separate Production gate acknowledged | Yes |

---

## 19. Final completion percentage

**Phase 1I locked scope: 100% complete** (1I-0 design through 1I-F closure documentation).

**Platform Production readiness for public directory: not claimed** — requires separate Owner Production decision.

---

## 20. Recommendation for next Player Management phase

Recommended next Owner-authorized phase (outside 1I):

1. **Staging fixture / privacy sample pack** (optional ops) — seed eligible public athletes under Staging-only authorize for live masking evidence; **or**
2. **Player Management Phase 1J** (Owner naming) — next product priority after directory MVP (e.g. self-profile polish, verification ops UX, or Production directory rollout checklist).

Do **not** start Phase 1J (or Production directory apply) until a new Owner authorize token.

---

## Key references

| Path | Role |
|------|------|
| `docs/player-management/phase-1i/03_PHASE_1I_IMPLEMENTATION_PLAN.md` | Plan status |
| `docs/player-management/phase-1i/07_PHASE_1I_C_DIRECTORY_LIST_UI.md` | List |
| `docs/player-management/phase-1i/08_PHASE_1I_D_DIRECTORY_DETAIL_UI.md` | Detail |
| `docs/player-management/phase-1i/09_PHASE_1I_E_QA_HARDENING.md` | QA / hardening |
| `docs/player-management/phase-1i/02_PHASE_1I_DATA_PRIVACY_CONTRACT.md` | Privacy freeze |
| `src/features/player/services/searchPublicDirectoryPlayers.js` | List facade |
| `src/features/player/services/getPublicDirectoryPlayer.js` | Detail facade |
| `src/auth/menuAccess.js` | Nav role gates + club override order |
