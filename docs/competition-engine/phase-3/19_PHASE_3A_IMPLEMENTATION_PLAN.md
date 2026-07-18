# 19 — Phase 3A Implementation Plan

**Status:** PROPOSAL ONLY — **not started**  
**Recommended name:** Runtime Control Plane and Shadow Infrastructure

---

## Verdict

| Item | Value |
|------|-------|
| **Recommended Phase 3A** | Runtime Control Plane and Shadow Infrastructure |
| **Alternative Phase 3A** | Non-Production persistence adapter stubs (in-memory→interface hardening) + rating RPC port extract design |
| **Why recommended** | No business capability should migrate without flags, modes, kill switch, parity storage, audit, and shadow isolation |
| **Why not Rules-first** | Rules bridges already exist; without control plane, enabling Rules V2 still lacks safe rollout/kill/parity ops |
| **Why not Participant-first** | Participant cutover needs persistence + shadow infra; contracts already closed in 2B.4 |

---

## Dependencies

```text
Phase 3.0 Owner review PASS
OG-3.0A … OG-3.0H = GO (or GO WITH CONDITIONS documented)
Architecture lock baseline ≤ 13 debt
Competition Core flags remain OFF on Production
```

---

## In scope (3A)

```text
Control plane resolver (mode + flag hierarchy)
Runtime mode enum + transition guards
Kill switch surfaces (design→code behind OFF defaults)
Shadow isolator (timeout, catch, sampling hooks) — Production hook OFF
Parity record writer (test/local sink first; remote sink optional OFF)
Audit log for control-plane changes (local/test acceptable)
Architecture tests for flag precedence / no ambient env in executors
Docs update: 3A entry/exit evidence
Optional: extract rating RPC port interface (no Production path change)
```

---

## Out of scope (3A)

```text
Participant Production activation
Registration/draw/standings cutover
Supabase schema / SQL migration
Dual-write
Backfill
Production shadow sampling ON
UI admin panel (unless Owner explicitly adds)
Tenant/competition pilots
Legacy deletion
Enabling any VITE_COMPETITION_CORE_* on Production
```

---

## Entry criteria

See `20_PHASE_3A_ENTRY_CRITERIA.md`.

---

## Exit criteria

```text
Resolver + mode state machine implemented and unit-tested
Kill switch overrides capability/tenant enablement (tests)
Shadow isolator never throws to caller (tests)
Parity record schema stable; test sink works
No Production behavior change (flags OFF)
Architecture lock PASS (debt ≤ 13)
Unit tests ≥ baseline; 0 failed
Build PASS
Owner accepts 3A exit report
```

---

## Suggested work packages

1. `runtime/controlPlane/` — resolveRuntimeDecision  
2. `runtime/modes/` — transitions  
3. `runtime/shadow/` — isolateShadowExecution  
4. `runtime/parity/` — records + classifications  
5. `runtime/audit/` — control plane audit  
6. Architecture invariant tests  
7. Wire points documented but **not** connected to Production request path  

Public export only via `competition-core/index.js`.
