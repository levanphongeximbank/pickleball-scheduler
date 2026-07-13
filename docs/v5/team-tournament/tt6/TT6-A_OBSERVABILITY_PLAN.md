# TT-6A — Observability Plan

**Date:** 2026-07-13  
**Status:** Design only — no instrumentation in TT-6A

---

## 1. Goals

- Detect Realtime degradation before users report stale UI
- Measure end-to-end latency (WAL → render)
- Audit security denials without leaking payloads
- Support TT-6B staging gates and TT-6C production readiness

**Hard rule:** Never log JWT, secrets, service-role keys, or full lineup payloads.

---

## 2. Metric catalog

| Metric key | Type | Description |
|------------|------|-------------|
| `tt_rt_channel_connected` | counter | Successful SUBSCRIBED per scope |
| `tt_rt_channel_disconnected` | counter | CLOSED / unsubscribe |
| `tt_rt_reconnect_attempt` | counter | Backoff retry fired |
| `tt_rt_polling_fallback_active` | gauge | 1 when degraded poll running |
| `tt_rt_duplicate_event_discarded` | counter | Same eventId seen twice |
| `tt_rt_stale_event_discarded` | counter | entityVersion <= local |
| `tt_rt_payload_conflict` | counter | Same version, different hash |
| `tt_rt_authorization_error` | counter | unauthorized / RLS fail |
| `tt_rt_snapshot_reload` | counter | By reason: reconnect, event, poll, manual |
| `tt_rt_event_to_reload_ms` | histogram | Envelope received → reload start |
| `tt_rt_reload_to_render_ms` | histogram | Reload start → React commit (TT-6B) |
| `tt_rt_consumer_to_client_ms` | histogram | Server `updated_at` → client render (approx via clock skew guard) |

Referee V5 adapter emits parallel metrics with prefix `rv5_rt_*` for continuity.

---

## 3. Structured log events (debug/staging)

```json
{
  "component": "TeamTournamentRealtimeService",
  "action": "event_discarded",
  "reason": "stale_or_duplicate",
  "eventId": "pg:team_tournament_sub_matches:…",
  "eventType": "sub_match.result_updated",
  "tenantId": "…",
  "tournamentId": "…",
  "entityVersion": 42,
  "localVersion": 42,
  "source": "postgres_changes"
}
```

**Redact:** `payload`, player names, lineup selections, scores beyond log level `debug` in production.

---

## 4. Log levels

| Level | Content |
|-------|---------|
| `error` | authorization_error, payload_conflict, channel ERROR after max visibility |
| `warn` | degraded mode entered, version gap reload |
| `info` | connect/disconnect, reconnect success |
| `debug` | discard reasons, timing (staging only) |

Production default: `info`. Staging QA: `debug` via env `VITE_TT_REALTIME_DEBUG=true`.

---

## 5. UI-visible diagnostics (optional TT-6B)

- Connection badge (reuse Referee V5 pattern)
- Last synced timestamp
- Degraded mode indicator
- **No** raw event stream in production UI

Dev-only panel: subscription scope list + connection state (SuperAdmin / dev route only).

---

## 6. Alerting recommendations (ops — future)

| Alert | Condition |
|-------|-----------|
| High degraded rate | >30% sessions in degraded > 2 min |
| Auth errors spike | authorization_error rate |
| Reload latency p95 | > 3s |
| Conflict rate | payload_conflict > threshold |

Not implemented in TT-6A — document for production rollout after TT-6 staging PASS.

---

## 7. Staging verification hooks (TT-6B)

Extend `scripts/verify-phase-tt6-staging.mjs` (future) to assert:

- Metrics counters increment on synthetic WAL update
- No secret patterns in stdout
- Degraded banner appears when Realtime disabled via flag

---

## 8. Privacy checklist

| Data | Log? |
|------|------|
| tenantId, tournamentId, matchupId | YES (ids only) |
| userId | Hashed or truncated |
| lineup selections | NO |
| JWT | NO |
| Full get-setup response | NO |
| eventId, entityVersion | YES |

---

## 9. Acceptance

| Criterion | Documented |
|-----------|------------|
| Core metrics defined | YES |
| No sensitive logging | YES |
| Latency hooks defined | YES |
| Staging hook plan | YES |
