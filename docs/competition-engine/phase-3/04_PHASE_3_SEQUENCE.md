# 04 — Phase 3 Sequence

**Date:** 2026-07-18  
**Principle:** Control plane before any business capability cutover. No big-bang. Owner GO per phase.

---

## Recommended order (official proposal)

| Order | Phase | Name | Depends on | Risk | Why this order |
|-------|-------|------|------------|------|----------------|
| 1 | **3A** | Runtime Control Plane + Shadow Infrastructure | Phase 3.0 Owner GO | Medium | Flags, modes, kill switch, parity store, isolation — prerequisite |
| 2 | **3B** | Participant Resolution Runtime | 3A | Critical | Identity collision is highest systemic risk; contracts complete |
| 3 | **3C** | Registration and Entry Runtime | 3A, 3B | High | Entries depend on stable participant refs |
| 4 | **3D** | Team and Roster Runtime | 3A, 3B | High | Format-owned; ports + shadow; TT cloud coordination |
| 5 | **3E** | Lineup Runtime | 3A, 3D | High | Revisions/locks after roster identity |
| 6 | **3F** | Seeding Runtime | 3A, 3C (entries) | High | Seeds before draw |
| 7 | **3G** | Draw and Grouping Runtime | 3A, 3F | High | Owner conditioned; invert TT adapter after parity |
| 8 | **3H** | Match Generation and Pairing Runtime | 3A, 3G | High | Needs draw graph; extract page-logic deps first |
| 9 | **3I** | Scheduling and Resource Runtime | 3A, 3H | High | Courts/slots after matches exist |
| 10 | **3J** | Match Lifecycle and Scoring Runtime | 3A, 3I | Critical | Live ops + Elo side effects |
| 11 | **3K** | Standings and Tie-break Runtime | 3A, 3J (results) | High | Strong CC suite; still multi-algorithm |
| 12 | **3L** | Publication Runtime | 3A, 3G, 3I | High | Public projection gates |
| 13 | **3M** | Production Cutover | Per-capability gates | Critical | Controlled; never all-at-once |
| 14 | **3N** | Legacy Retirement | Canonical SSOT + read-only window | Medium | Delete only after retirement criteria |

---

## Naming / split notes

- **3A renamed/scoped** from vague “Rules Runtime” → **Control Plane + Shadow Infrastructure**. Rules promotion remains a capability workstream (may run as **3A′ Rules bridge hardening** only after control plane, or as part of 3E/3G validation) — Owner chooses.
- **Standings (historically P0)** deliberately **after** lifecycle scoring so parity inputs are real results, not fixtures alone. Shadow standings can start earlier under 3A infra.
- **Team/Roster/Lineup** stay format-owned per Owner Decision; phases 3D–3E migrate **ports, identity, shadow, dual-write** — not a V6 rewrite.
- **TE4** is not a separate Phase 3 letter; it is a **competing stack** that must either shadow-parity against Core or be frozen/deprecated under 3M–3N.

---

## Per-phase exit criteria (summary)

| Phase | Exit criteria |
|-------|---------------|
| 3A | Control plane API, mode resolver, kill switch, parity recorder, shadow isolator, architecture tests; flags still OFF on Production |
| 3B | Participant resolve shadow parity thresholds; persistence adapter non-prod; no silent guest loss |
| 3C | Registration/entry shadow + idempotent create; waitlist parity |
| 3D–3E | Roster/lineup shadow; lock/revision parity; no hidden-lineup leak |
| 3F–3G | Deterministic seed/draw parity for locked modes; Owner GO for invert |
| 3H–3I | Match graph + schedule semantic parity; page-logic extraction debt reduced |
| 3J | Lifecycle state machine + score validation parity; Elo path isolated |
| 3K | Standings exact/policy thresholds met across formats |
| 3L | Publish/lock parity; public gates unchanged under rollback |
| 3M | Per-capability cutover checklist complete + Owner GO |
| 3N | Legacy read-only window complete; no Production callers; CI forbids imports |

---

## Rollback scope by phase

| Phase | Rollback scope |
|-------|----------------|
| 3A | Disable control plane modules; no data impact |
| 3B–3E | Flag → LEGACY_ONLY; reconcile if dual-write started |
| 3F–3I | Flag → LEGACY_ONLY; discard unpublished canonical draws/schedules |
| 3J–3K | Immediate kill switch; reconcile results/standings projections |
| 3L | Unpublish/republish via legacy; snapshot restore |
| 3M–3N | Re-enable legacy executors; halt deletion |

---

## Forbidden jumps

```text
LEGACY_ONLY → CANONICAL_ONLY          FORBIDDEN without Owner exception
Skip shadow for Production capability FORBIDDEN without Owner exception
All-tenant default-on                 FORBIDDEN until pilot gates pass
```
