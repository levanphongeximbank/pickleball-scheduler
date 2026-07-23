# CORE-02 — Role & Permission Adapter — Ownership Boundary

**Owner CORE:** CORE-02 — Competition Role & Permission Adapter  
**Module:** `src/features/competition-core/role-permission/`  
**Docs path:** `docs/competition-engine/core-02-role-permission/`  
**Branch intent:** `feature/competition-core-02-role-permission-adapter`

> **Alias rule:** Historical `docs/competition-engine/core-02/` and `participants/` describe **Participant & Entry** (Owner **CORE-03**). Do **not** overwrite or reclaim those paths. This folder is the Owner CORE-02 documentation SoT.

---

## 1. Owns

| Concern | Notes |
|---------|-------|
| Competition role / permission identifiers | May equal Identity string values; catalog projection, not Identity SoT |
| Competition action vocabulary | Includes Team + Lineup actions (Phase 1B minimum) |
| Action → permission mapping | Fail-closed when unmapped |
| Authorization subject / scope / request / decision | Canonical CORE-02 contracts |
| Evidence + explanation | Typed deny reasons |
| Fail-closed `evaluateAuthorization` | Independent of `VITE_RBAC_ENABLED` |
| Identity **projection** via injected evidence port | Never owns Identity admin/UI/RLS |
| Consumer compatibility adapters | Team / Lineup port wrappers; Match / Workflow projectors |

---

## 2. Does not own

| Concern | Owner |
|---------|-------|
| Authentication / sessions / passwords | Identity |
| Identity permission / role catalog SoT | Identity (`features/identity/`) |
| `rbac.can()` fail-open client helper | `src/auth/rbac.js` — **must not** be CORE-02 domain default |
| RLS / Supabase / SQL | Platform |
| Team / Lineup / Match / Workflow business rules | Owner CORE-06 / 07 / 15 / 21 (repo trees) |
| Participant & Entry domain | Owner CORE-03 (`participants/`, historical `docs/.../core-02`) |
| Court assignment | CORE-12 — **do not reopen** |
| Production cutover / root barrel / main CI manifest | Integrator |

---

## 3. Architecture

```text
Platform Identity / RBAC
        ↓  (injected evidence / projection only)
CORE-02 Competition Role & Permission Adapter
        ↓  (port implementations + decision projectors)
Team / Lineup / Match / Workflow authorization surfaces
```

---

## 4. Fail-closed policy

- Missing subject, scope, action, mapping, evidence port, or malformed input → **deny**
- Missing Identity evidence → **deny** (even when platform RBAC is off)
- Never call `rbac.can()` as the evaluator default
- Never invent tenant / venue / competition from “first available”

---

## 5. Phase 1B non-goals

- Production wiring / feature flags ON
- Root `competition-core/index.js` exports
- Main `scripts/ci/unit-test-files.json` promotion
- Identity SoT / SQL / UI edits
- Edits to Team / Lineup / Match / Workflow cores (wrappers live in CORE-02)
- LineupVisibilityPort / RLS / CORE-12
