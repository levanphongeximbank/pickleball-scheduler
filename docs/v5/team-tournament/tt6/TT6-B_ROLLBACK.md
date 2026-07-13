# TT-6B — Rollback

1. Set `VITE_TT_REALTIME_ENABLED=false` — immediate polling-only fallback.
2. Staging SQL rollback:
   - `ALTER PUBLICATION supabase_realtime DROP TABLE ...` for TT-6B tables
   - `DROP POLICY tt6_*` from security SQL
3. Revert repository delegate commit if needed.

Official results and TT-5 ownership unchanged.
