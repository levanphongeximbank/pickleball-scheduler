# COMMS-ACT-06 — Owner GO Package

## ACT-06 (this act)

Không có Production mutation GO. Owner chỉ cần:

1. Review PR ACT-06 readiness package.
2. Xác nhận env metadata Production (presence only) — template `evidence/OWNER_ENV_METADATA_TEMPLATE.md`.
3. Xác nhận Dashboard backup/PITR Production khả dụng.
4. **Không** set `COMMS_PRODUCTION_RUNTIME_ENABLE` trong ACT-06.

## ACT-07 tokens (preview — exact strings)

| Gate | Exact token |
|------|-------------|
| Enable Production runtime binding | `OWNER GO COMMS-ACT-07 PRODUCTION ENABLE` |
| Schema apply only | `OWNER GO COMMS-ACT-07 PRODUCTION SCHEMA_APPLY_ONLY` |
| Deploy only | `OWNER GO COMMS-ACT-07 PRODUCTION DEPLOY_ONLY` |
| Smoke only | `OWNER GO COMMS-ACT-07 PRODUCTION SMOKE_ONLY` |

## Next single Owner action (after ACT-06 PR)

> Xác nhận trên Vercel Production + Supabase Production (`expuvcohlcjzvrrauvud`): các secret Communication có mặt (yes/no), không dính Staging ref, và Backup/PITR khả dụng — rồi trả lời Agent bằng checklist presence (không dán secret).
