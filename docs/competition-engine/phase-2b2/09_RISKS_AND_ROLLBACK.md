# 09 — Risks and Rollback

## Risks

| Risk | Mitigation |
|------|------------|
| Accidental runtime wiring | Phase scope forbids format cutover; flags remain OFF |
| Over-strict validators blocking later adapters | Policy context hooks (`allowDuplicateScope`, require* flags) |
| Mistaking in-memory ports for Production persistence | Documented test fake only |
| Deep imports of participants internals | Public API export + architecture lock |

## Rollback

Revert the Phase 2B.2 commit/PR.  
No database, env, or feature-flag rollback required.
