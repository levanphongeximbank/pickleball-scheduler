# 09 — SQL Risk Register

| ID | Risk | Severity | Mitigation in package |
|----|------|----------|------------------------|
| R1 | Inventing `birth_date` from `birth_year` | High | Not implemented; left NULL |
| R2 | Legacy birth_date/year mismatch CHECK fails apply | High | Consistency CHECK omitted (app-owned) |
| R3 | Privacy default exposes PII | High | Fail-closed jsonb backfill |
| R4 | Self sets `identity_verification_status=verified` | High | Trigger guard blocks self |
| R5 | Weakening RLS / anon PII | High | No RLS policy changes |
| R6 | Over-constrained activity_region | Medium | Object-only CHECK; no FKs; no GIN |
| R7 | ENUM migration pain later | Medium | text + CHECK |
| R8 | Guard replace diverges from Phase C | Medium | Rollback restores Phase C body |
| R9 | Partial re-apply leaves nullable verification | Low | Documented; prefer full apply once |
| R10 | Rollback data loss | High | Explicit export warning in rollback docs |
| R11 | Assuming SQL = durable Player writes | High | Verdict: AUTHORIZATION WIRING REQUIRED |
| R12 | Rating verification confusion | Medium | Column comment + naming = identity only |

## Residual open items

1. Wire `updatePlayerProfile` → Supabase repository (separate task).
2. Directory/public read projector must hide sensitive fields unless privacy flags allow.
3. Staging apply + verification still required before any Production gate.
