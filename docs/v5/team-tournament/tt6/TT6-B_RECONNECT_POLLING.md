# TT-6B — Reconnect & Polling

## Reconnect

Backoff: 1s → 2s → 5s → 10s → 30s (+ jitter). On success: mandatory snapshot reload.

## Polling fallback

| Scope | Interval |
|-------|----------|
| sub_match / referee_match | 4s |
| tournament / matchup | 8s |
| hidden tab | paused / 15s |

Stop polling when Realtime `SUBSCRIBED`. Degraded state shows non-realtime banner (TT-6C UI).

## Cleanup

`unsubscribe()` clears channel, reconnect timer, polling timer, adapter.
