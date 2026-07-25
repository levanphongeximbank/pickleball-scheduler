# COACHING-03 — Staging Preflight (Gate A + Gate B)

## Modes

| Mode | Network | DB write | Purpose |
|------|---------|----------|---------|
| Default (offline) | None | None | Manifest, approval defaults, static safety |
| `--live-readonly` | Staging Management API only | Forbidden — `BEGIN READ ONLY` + `ROLLBACK` | Catalog / collision / helper probes |

Preflight **refuses** `--execute` / `--apply` / `--apply-staging`.

## Script

```bash
node scripts/coaching/coaching-03-staging-preflight.mjs
node scripts/coaching/coaching-03-staging-preflight.mjs --live-readonly --environment=staging
```

## Offline checks (Gate A)

- Worktree / branch awareness (reported; not mutated)
- Manifest load + SHA verify (forward order 10→60, rollback 90, verification 99)
- Phase 28 exclusion
- Approval template defaults: `approved=false`, `environment=staging`, `productionAllowed=false`
- Role matrix completeness (14 actions; PLAYER broad read denied)
- Read-only probe SQL static allowlist PASS
- Package.json apply shortcut absent

## Live read-only checks (Gate B)

Only when `--live-readonly` **and** read-only enforcement proven:

1. Target project ref = Staging allowlist `qyewbxjsiiyufanzcjcq`
2. Production ref / domain blocklist
3. Execute `buildCoaching03ReadOnlyCatalogProbeSql()` via Management API URL hardcoded to Staging ref
4. Probe wrapped in `BEGIN TRANSACTION READ ONLY` … `ROLLBACK`
5. Static verb scanner rejects INSERT/UPDATE/DELETE/DDL/RPC mutation
6. Read PostgreSQL version, catalog presence (`to_regclass`), helper signatures, RLS flags, permission counts (no PII columns)
7. Write sanitized evidence under `docs/coaching-training/coaching-03/evidence/`

## Block if

- Target is Production
- Project ref mismatch
- Cannot guarantee read-only (missing BEGIN READ ONLY path / token / scanner fail) →  
  **`COACHING_03_REMOTE_READ_ONLY_PREFLIGHT_BLOCKED`** (local package may still complete)
- Canonical auth helpers missing or signature drift (live)
- Coaching object collision / Phase 28 conflict (live)
- Permission catalog shape mismatch (live)
- Required extension missing (live)
- Secrets would be logged

## Evidence

Sanitized JSON only. Never print URL credentials, access tokens, passwords, or service-role keys.

## Explicit non-actions

No INSERT/UPDATE/DELETE/UPSERT/DDL/permission seed/role grant/fixture/QA login/password reset/auth create/metadata mutation/Supabase project config update.
