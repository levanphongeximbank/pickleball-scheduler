# 10 — Feature Flags and Kill Switch

**Status:** Design — extends existing OFF-by-default CC flags  
**Phase 3.0:** No flag implementation / enablement / env change

---

## Existing base (Production today)

| Env key | Helper | Default |
|---------|--------|---------|
| `VITE_COMPETITION_CORE_ENABLED` | `isCompetitionCoreEnabled` | false |
| `VITE_COMPETITION_CORE_RATING_V2_ENABLED` | `isRatingV2Enabled` | false |
| `VITE_COMPETITION_CORE_RULES_V2_ENABLED` | `isRulesV2Enabled` | false |
| `VITE_COMPETITION_CORE_DRAW_V2_ENABLED` | `isDrawV2Enabled` | false |
| `VITE_COMPETITION_CORE_FORMATION_V2_ENABLED` | `isFormationV2Enabled` | false |
| `VITE_COMPETITION_CORE_MATCHMAKING_V2_ENABLED` | `isMatchmakingV2Enabled` | false |
| `VITE_COMPETITION_CORE_STANDINGS_V2_ENABLED` | `isStandingsV2Enabled` | false |
| `VITE_COMPETITION_CORE_SCHEDULING_V2_ENABLED` | `isSchedulingV2Enabled` | false |

Sub-flags require master CORE. Parsing only via `envReader.js` / injected env.

TT flags (`VITE_TEAM_TOURNAMENT_*`) remain format-owned; control plane must compose them, not ignore them.

---

## Hierarchy (Phase 3A target)

See `05_RUNTIME_CONTROL_PLANE.md`. Summary:

```text
Kill switch > Global OFF > Rollback marker > Competition > Tenant > Format > Capability > Shadow > Env default
```

Shadow flag **never** changes user-facing output.

---

## Kill switch hierarchy

| Switch | Scope | Effect |
|--------|-------|--------|
| Global | All CC | LEGACY_FALLBACK / LEGACY_ONLY |
| Capability | One capability | Legacy executor for that capability |
| Format | One format | Legacy for that format |
| Tenant | One tenant | Legacy for tenant |
| Competition | One competition | Sticky competition mode |

### Kill switch properties

```text
Effective immediately (runtime override store — no redeploy required once designed)
No DB migration required to activate (if override store already deployed)
Audit log mandatory
Does not delete data
Forces legacy or read-only safe mode
```

### Who may activate

| Role | Global kill | Capability kill | Tenant/Competition kill | Default-on cutover |
|------|-------------|-----------------|-------------------------|--------------------|
| SUPER_ADMIN | Yes | Yes | Yes | Yes (with Owner policy) |
| SYSTEM_TECHNICIAN | Yes | Yes | Yes | No |
| OWNER_APPROVED_OPERATOR | Limited | Yes (assigned) | Yes (assigned) | No |
| Venue Owner | **No** | No | Own competitions only if granted | **No** |

Venue Owner must **not** have global cutover by default.

---

## Flag misconfiguration defenses

1. Control plane rejects CANONICAL_PRIMARY if shadow gate not recorded.
2. Preview/Production boot warns if CORE=true without Owner marker (future).
3. Architecture tests: global OFF overrides tenant ON; kill overrides capability enablement.
4. Dashboard shows effective resolved flags per competition.

---

## Rollback vs kill switch

| Action | Use when |
|--------|----------|
| Kill switch | Immediate safety; stop canonical execute/write |
| Feature flag rollback | Planned demotion SHADOW ← PRIMARY |
| Deploy rollback | Bad build; flags alone insufficient |
| Data reconciliation | After dual-write divergence |

**Turning a flag off is not enough** after dual-write or canonical-write — see `12_ROLLBACK_AND_RECONCILIATION.md`.
