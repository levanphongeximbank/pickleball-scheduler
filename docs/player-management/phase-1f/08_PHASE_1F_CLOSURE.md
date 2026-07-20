# Phase 1F — Formal Closure Evidence

**Final verdict:** `PHASE_1F_CLOSED`  
**Owner decision:** `CLOSE_PHASE_1F_NOW`  
**Closure date:** 2026-07-20 (UTC+7)  
**Docs branch (this package):** `docs/player-phase-1f-closure`  
**origin/main SHA at closure authoring:** `9f25e08e5ebc2302fe3a0ab24d702b81a7d0f2ca`  
**B2 merge on main:** PR #98 (`9f25e08`)

---

## 1. Frozen Phase 1F scope

| Field | Value |
|-------|--------|
| Scope freeze | `00_PHASE_1F_SCOPE_FREEZE.md` — Owner `APPROVE_PHASE_1F_SCOPE` |
| Classification | **E — staged A → B** |
| In scope | Self profile read surface (1F-A); privacy + public-profile enforcement (1F-B1 projector, 1F-B2 directory/search wire-up) |
| Optional | 1F-B3 minimal public Player UI (projector-backed only) |
| Deferred | 1F-C identity verification admin workflow; 1F-D legacy writer / V2 dossier / blob cutover |
| Schema / Production | **No** new Production schema migration; **no** SQL apply; **no** deploy expected |

Hard rules preserved:

1. Do not ship public/directory reads without the privacy projector.
2. Do not rewrite Club / Competition / Ranking / Rating / Venue / Notification in the same wave.
3. Do not expand into C or D without Owner `REVISE_SCOPE`.

---

## 2. Sub-phase outcomes

| Sub-phase | Outcome | Evidence |
|-----------|---------|----------|
| **1F-A** | **Closed** — authenticated self-profile foundation **read** surface | `03_PHASE_1F_A_IMPLEMENTATION_EVIDENCE.md` |
| **1F-B1** | **Closed** — canonical fail-closed public projector | `06_PHASE_1F_B1_IMPLEMENTATION_EVIDENCE.md` |
| **1F-B2** | **Closed** — explicit viewer modes + directory/search wire-up | `07_PHASE_1F_B2_IMPLEMENTATION_EVIDENCE.md` |
| **1F-B3** | **Skipped** (optional) — no concrete product/route need | Owner `CLOSE_PHASE_1F_NOW` |
| **1F-C** | **Deferred** | Out of scope |
| **1F-D** | **Deferred** | Out of scope |

### 1F-A outcome

- Canonical self read: auth session → `getAuthenticatedSelfPlayerProfile` → `fetchProfileByUserId` → `getPlayerProfileByAuthUser` → `getPlayerProfile`.
- Foundation fields displayed on Athlete + My Profile via `SelfPlayerProfileFoundationRead`.
- `identity_verification_status` read-only on self; no public projector in this sub-phase.

### 1F-B1 outcome

- Pure projector: `src/features/player/projectors/projectPublicPlayerProfile.js`.
- Exported from `src/features/player/index.js`.
- Missing/null/malformed privacy → opaque (`visible: false`); `publicProfileEnabled !== true` → opaque.
- Flag-gated fields only when public enabled; never projects verification, raw privacy settings, auth identifiers, roles, timestamps, rating/ranking refs.

### 1F-B2 outcome

- Viewer modes: `public` \| `directory` \| `internal` (`constants/viewerModes.js`).
- `searchPlayers` requires explicit `mode` / `viewerMode`; omitted/unknown **fail closed**.
- Public/directory → `projectPublicPlayerProfile`; hidden profiles **excluded** (`meta.hiddenCount`).
- Wrappers: `searchPublicPlayers`, `searchDirectoryPlayers`, `searchInternalPlayers`.
- Self-profile path unchanged and separate from directory search.

### B3 decision

**Not required.** Frozen scope marked B3 optional. Final readiness audit found no projector-backed public Player route product need. Owner closed Phase 1F without B3.

### C/D deferred boundary

| Item | Status |
|------|--------|
| Identity verification admin / privileged RPC UI | **Deferred (1F-C)** |
| Link & dedupe tooling | **Deferred** |
| Full `PlayerProfile.jsx` / V2 dossier cutover | **Deferred (1F-D)** |
| Club blob / AI session player write retirement | **Deferred (1F-D)** |

---

## 3. Canonical contracts (closed state)

### Self-read path

```
authenticated session
  → getAuthenticatedSelfPlayerProfile
  → fetchProfileByUserId
  → getPlayerProfileByAuthUser (requirePlayerRow: false)
  → getPlayerProfile → adaptProfileRow → normalizePlayerProfile
```

Full authorized self fields; **not** stripped by the public projector.

### Public projector

| Item | Path / export |
|------|----------------|
| Module | `src/features/player/projectors/projectPublicPlayerProfile.js` |
| Privacy SSOT | `src/features/player/constants/privacy.js` |
| Public API | `projectPublicPlayerProfile`, `buildOpaquePublicPlayerProfile`, `PUBLIC_PROFILE_HIDE_REASON` |

### Explicit viewer-mode contract

| Mode | Behavior |
|------|----------|
| `public` | Projector; exclude non-visible |
| `directory` | Same projector policy as public |
| `internal` | Full normalized profiles; **explicit only; never default** |
| omitted / unknown | Fail closed (`ok: false`, empty `data`) |

### Fail-closed behavior

1. Omitted viewer mode → `VIEWER_MODE_REQUIRED`.
2. Unknown viewer mode → `VIEWER_MODE_UNSUPPORTED`.
3. Missing/null/malformed privacy on public/directory → opaque / excluded.
4. `publicProfileEnabled !== true` → not visible / excluded from directory results.

### Protected-field guarantees (public/directory)

Never returned by default (and never via projector): raw `privacySettings`, `identity_verification_status` / verification internals, `authUserId`, roles, account/profile status, timestamps, rating/ranking refs, metadata dumps.

Phone, email, birth date/year, gender, handedness, activity region, club memberships — only when `publicProfileEnabled` and the corresponding `show*` flag is true.

---

## 4. Test evidence (closure audit on main `9f25e08`)

| Suite | Result |
|-------|--------|
| Focused 1F-A + 1F-B1 + 1F-B2 | **43/43 pass** |
| All `tests/player-management*.test.js` | **143/143 pass** |

Primary test files:

- `tests/player-management-phase-1f-a-self-profile-read.test.js`
- `tests/player-management-phase-1f-b1-public-projector.test.js`
- `tests/player-management-phase-1f-b2-directory-wireup.test.js`

---

## 5. Production / SQL / deploy boundary

| Check | Result |
|-------|--------|
| New Production schema SQL for Phase 1F | **No** |
| Production SQL applied | **No** |
| Production data mutated | **No** |
| Frontend / Vercel deployment for Phase 1F | **No** |
| Club / Competition / Ranking / Rating / Venue / Notification rewrites | **No** (not in 1F delivery) |

Phase 1E Production foundation columns remained the schema baseline; 1F consumed them in app code only.

---

## 6. Final verdict

**`PHASE_1F_CLOSED`**

Phase 1F frozen scope (staged A → B) is complete on `main` at `9f25e08`. Optional B3 was intentionally skipped. C and D remain deferred pending separate Owner scope decisions.

---

## 7. Next-phase boundary

Do **not** treat the following as open Phase 1F work:

1. **1F-B3** public Player UI — only if a later Owner product gate requires a projector-backed public surface.
2. **1F-C** — identity verification admin workflow / privileged RPC UI.
3. **1F-D** — legacy writer cutover, link/dedupe, full V2 dossier migration, club blob write retirement.
4. Any Production SQL apply or deploy — requires a **separate** Owner gate.

Suggested next Owner choice (outside this closure): open a new discovery/scope freeze for C, D, or an unrelated Player Management wave — do not reopen 1F.
