# CC-10 — Rollout Plan

**Not executed in CC-10.** Plan only.

## Stage 0 — Production flags OFF (current)

- Entry: default
- Flags: all OFF
- Scope: all tenants
- Monitoring: baseline error rates
- Rollback: n/a

## Stage 1 — Staging shadow

- Entry: CC-10 PASS, build green, owner GO
- **Status (2026-07-13):** **COMPLETE** — Preview SHADOW deployed, 20/20 PASS, rollback drill PASS
- Flags: CORE=ON, module SHADOW flags ON (except Rating per RPC verify)
- Scope: staging project `qyewbxjsiiyufanzcjcq`
- Monitoring: Decision Trace parity, mismatch policy
- Mismatch threshold: zero BLOCKING
- Rollback trigger: any BLOCKING mismatch
- Rollback: disable module flags → legacy
- Owner approval: required

## Stage 2 — Internal test tenant shadow

- Entry: Stage 1 zero blocking mismatches
- Flags: same as Stage 1 on preview branch
- Scope: isolated test tenant/tournament only
- Monitoring: 20-case shadow matrix
- Rollback trigger: data safety violation
- Rollback: master flag OFF

## Stage 3 — Selected non-critical tournament shadow

- Entry: Stage 2 pass
- Scope: one internal/weekly tournament
- Monitoring: operator review + trace export

## Stage 4 — Canonical-primary one module (staging only)

- Entry: Stage 3 pass + owner GO
- Candidate: Standings or Rules (lowest write risk)
- Flag: single module canonical-primary on staging only
- Rollback: module flag OFF within 5 minutes

## Stage 5 — Canary production (one module)

- Entry: Production GO checklist complete
- Scope: one low-risk tenant
- Monitoring: 24h smoke

## Stage 6 — Gradual module rollout

- Module-by-module production flags with 48h soak between modules
