# COMMS-ACT-05 — Rollback / Recovery Plan

## If smoke fails mid-run

1. Stop further writes.
2. Run fixture cleanup → marker count 0.
3. If cleanup insufficient or unknown damage: restore Staging from **ACT-05** backup.
4. Do not restore Production (untouched).
5. Do not re-open Community / Realtime.

## If host wiring regresses

1. Remove/disable `VITE_COMMUNICATION_TRUSTED_BACKEND`.
2. Runtime returns UNAVAILABLE / DEMO (dev) without silent production success.
3. Client RLS Club SELECT from ACT-04 remains unchanged.

## Forward-fix preference

Prefer delete smoke fixtures + re-run over schema DROP. Schema DROP is not an ACT-05 tool.
