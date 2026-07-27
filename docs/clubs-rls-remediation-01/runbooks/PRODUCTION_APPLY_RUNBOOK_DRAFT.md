# CLUBS-RLS-REMEDIATION-01 — Production Apply Runbook (DRAFT ONLY)

**Status:** DRAFT — **NOT AUTHORIZED** — **NOT EXECUTED**
**Prerequisite:** Staging certified (`CLUBS_RLS_REMEDIATION_STAGING_CERTIFIED`) with N1–N10 evidence.

## Hard gates (all required)

1. Staging post-apply evidence attached and Owner-reviewed.
2. Separate Production GO ticket / Owner authorization (one-time).
3. Production backup / PITR confirmed.
4. Forward SQL identical to Staging-certified bytes (checksum recorded).
5. Maintenance window + rollback owner named.
6. Connection target MUST be `expuvcohlcjzvrrauvud` only after GO; Staging scripts must not be reused blindly.

## Proposed order (after GO)

1. Read-only Production preflight (same queries as Staging `00_*`).
2. Confirm Production still has broad `clubs_select` branch (blocker live).
3. Apply forward SQL in a single transaction.
4. Post-apply verify + N1–N10 against Production fixtures.
5. Smoke Club Management + Public Catalog.
6. Record Production certification separately — do **not** reuse Staging verdict.

## Rollback

Use `sql/90_CLUBS_RLS_REMEDIATION_01_ROLLBACK.sql` only if Production forward was applied and a critical regression requires restoring the prior policy (re-opens B-CLUBS-RLS-01 — Owner risk acceptance required).

## Explicit non-goals of this draft

- Does not authorize apply
- Does not change Vercel
- Does not deploy app
- Does not grant Production PASS from this workstream package alone
