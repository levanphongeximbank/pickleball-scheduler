# Foundation → final composition

On disposable PostgreSQL 16.4 only (not Staging, not Production):

1. foundation PRECHECK — PASS
2. foundation APPLY — PASS
3. foundation VERIFY — PASS (`CANONICAL_REFEREE_LIFECYCLE_PRESTATE_READY=YES`)
4. `team-tournament-canonical-referee-lifecycle-01` PRECHECK — PASS
5. final APPLY — PASS
6. final VERIFY — PASS
7. `create_referee_assignment` body after final APPLY contains `v_parent` — PASS
8. Foundation ROLLBACK with final continuation present — REFUSED as designed

Final package hashes unchanged:

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `ce9392188218e9a0ee5c45aa0b64ae3955079c2b4c33622b0109a238b71b8956` |
| `02_APPLY.sql` | `eb0fab536f400178339260c259c9ec5ae40e8394ee14913f50bedadda39d7bdb` |
| `03_VERIFY.sql` | `29e21fc20dc0db0af1607129efd259f7920e4f1e3d07348801f48ab0b03a8859` |
| `04_ROLLBACK.sql` | `cbe029e5f4c159fd4e414adcceb45b73781390199c8a76bc3fbc4160947e733d` |

FOUNDATION_TO_FINAL_COMPOSITION=PASS
