# Phase 7 Production Read-only Access Contract

Target: `expuvcohlcjzvrrauvud`.

Only the Supabase Management API endpoint `POST /v1/projects/{ref}/database/query/read-only` is permitted. The endpoint executes as `supabase_read_only_user`. The local guard permits one `SELECT` statement, rejects mutation-capable keywords and pins the exact project ref.

The access token must be supplied through `SUPABASE_ACCESS_TOKEN` or the gitignored local file `.env.phase7-production.local`, must never be committed or printed, and must belong to an account with only the minimum project database read permission needed for the endpoint. Absence of the token means stop before Production access.

Forbidden: general `/database/query` with write capability, direct owner connection, service-role row reads, SQL editor writes, DDL/DML, Storage writes and deployment actions.

Current status: `PRODUCTION_READ_ONLY_EVIDENCE_CAPTURED`.

```text
PRODUCTION_GO=NO
PHASE7_PRODUCTION_READ_ONLY_ACCESS_COUNT=15
PHASE7_PRODUCTION_MUTATIONS=0
```
