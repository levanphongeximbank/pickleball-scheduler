# Phase 1B — Production Rollout Plan (planning only)

**Status:** Preflight complete — **await Owner GO**  
**Approved code SHA:** `959c8067ea756aa32e50b549a97cd4e762786ff7`  
**Production:** `expuvcohlcjzvrrauvud`  
**Staging:** `qyewbxjsiiyufanzcjcq` (reference only; already PASS)

See live findings: `docs/v5/qa-evidence/phase1b-production/PRODUCTION_PREFLIGHT_REPORT.md`

## Hard rules until Owner GO

- Do not apply Production SQL
- Do not deploy Production code
- Do not modify Production data
- Do not start Phase 1C
- Do not delete `feature/club-phase-1-management-foundation` yet

## Apply order (when GO)

1. Additive audit whitelist  
2. club_update RPC (+ `phase42_can_update_club`)  
3. Member add/remove  
4. Member restore  
5. Phase 1B VP completion  
6. club_update authz security gate  
7. Catalog verify  
8. Deploy code `959c806`  
9. Production smoke tests  

## Why order matters on this Production

Production already has older `club_update` / member / assign-VP functions **without** narrow auth helpers and **without** clear-VP + canonical VP hydrate. Full bundle `CREATE OR REPLACE` closes the gap. **Code deploy must follow SQL verify.**
