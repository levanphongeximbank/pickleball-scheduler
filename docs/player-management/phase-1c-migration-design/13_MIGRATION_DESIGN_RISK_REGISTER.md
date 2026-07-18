# 13 — Migration Design Risk Register

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | Dual-write Identity vs Player demographics | High | Single write cutover plan; remove side writers |
| R2 | Hybrid ownership confusion (Identity vs Player) | Medium | Contract docs + allowlists + guard trigger |
| R3 | Non-auth players lack durable storage | Medium | Explicit deferral; no fake profiles inserts |
| R4 | Privacy jsonb partial keys | Medium | normalizePrivacySettings fail-closed |
| R5 | birth_date/year legacy conflicts | Medium | Reject new conflicts; report-only backfill |
| R6 | Public leakage of DOB/phone | High | Fail-closed privacy + projector; no anon raw select |
| R7 | CHECK too strict for legacy dirty data | Medium | Prefer app validation; careful CHECK rollout |
| R8 | Accidental Production apply | High | Design-only now; Production gate checklist |
| R9 | Rating verification confused with identity | Medium | Separate column name + enums |
| R10 | Option B later dual SSOT | Medium | Do not start player_profiles until Owner phase |

## Residual conditions

- Auth-linked only for durable Phase 1C wave  
- Executable SQL not yet authored  
- Staging/Production untouched  
