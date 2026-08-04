# Staging Six RLS ERROR Audit

Date: 2026-08-04 (Asia/Saigon)

Mode: **READ-ONLY AUDIT**

Target: Staging `qyewbxjsiiyufanzcjcq`

Baseline: `origin/main@177aae7b` (PR #361 merged)

## Verdict

**6/6 CONFIRMED — REMEDIATION REQUIRED**

All six Supabase Advisor ERROR targets are regular `public` tables with RLS disabled. Both `anon` and `authenticated` currently hold SELECT, INSERT, UPDATE, and DELETE privileges on every target. All six tables contain zero rows and have zero RLS policies; the empty state reduces present data disclosure but does not remove the write/poisoning risk.

## Exact targets

| Table | Domain | Rows | Tenant key | Sensitive/operational content | Repository provenance | Classification |
|---|---|---:|---|---|---|---|
| `match_game_states` | Referee V5 | 0 | `tenant_id` | live scores, winner, timestamps | V5A foundation; omitted from its RLS-enable list | `OPEN_BLOCKER` |
| `match_incidents` | Referee V5 | 0 | `tenant_id` | incident description, reporter UUID, metadata | V5A foundation; omitted from its RLS-enable list | `OPEN_BLOCKER` |
| `match_participant_positions` | Referee V5 | 0 | `tenant_id` | player/team position and server/receiver state | V5A foundation; omitted from its RLS-enable list | `OPEN_BLOCKER` |
| `referee_device_sessions` | Referee V5 | 0 | `tenant_id` | assignment/device label and activity timestamps | V5A foundation; omitted from its RLS-enable list | `OPEN_BLOCKER` |
| `rating_proposals` | Rating CC-02 | 0 | inherited through `player_rating_id` | current/proposed skill, confidence, review status | CC-02 schema has no RLS section | `OPEN_BLOCKER` |
| `rating_confidence_events` | Rating CC-02 | 0 | inherited through `player_rating_id` | confidence history, match reference, note | CC-02 schema has no RLS section | `OPEN_BLOCKER` |

## Exposure evidence

For each table:

- `relrowsecurity=false`;
- no rows in `pg_policies`;
- `anon`: SELECT/INSERT/UPDATE/DELETE = true;
- `authenticated`: SELECT/INSERT/UPDATE/DELETE = true;
- not extension-owned;
- exposed through the default `public` Data API schema.

No fixture was inserted because this audit was explicitly read-only. A zero-row anonymous read is not accepted as proof of safety while RLS is disabled and DML privileges remain.

## Dependency and callsite findings

- No direct table client callsite was found under `src/`, `scripts/`, or application tests.
- No current public database function or view definition references any of the six tables.
- The four Referee tables are future/normalized operational tables. The V5A SQL comment states policies belong to a later V5E phase, but only six sibling tables were actually enabled for RLS.
- The two Rating tables are child records of `player_ratings`. They do not carry `tenant_id`, so any future row policy must authorize through the parent relationship rather than a missing local tenant column.

## Risk assessment

Severity remains **CRITICAL as a group** because unauthenticated callers have full DML grants on exposed operational tables. Empty tables prevent current row disclosure but allow unauthorized inserts when foreign-key prerequisites can be satisfied and would expose future rows immediately.

## Audit decision

- `REMEDIATE`: all six.
- `DEFER`: none.
- `OUT_OF_SCOPE`: none.
- Production claim: none.
- Staging mutations: 0.
- Production access/mutations: 0/0.

No SQL package has been applied or approved by this audit.

