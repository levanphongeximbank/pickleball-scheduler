# TT-6C — Rollback

1. Set `VITE_TT_REALTIME_ENABLED=false` on Preview/Staging — immediate polling-only (no channel creation).
2. Redeploy Preview without flag change if UI issue — pages still work via 5s poll.
3. SQL rollback not required for UI-only rollback (TT-6B RLS/publication remain; safe with flag off).

Production: unchanged.
