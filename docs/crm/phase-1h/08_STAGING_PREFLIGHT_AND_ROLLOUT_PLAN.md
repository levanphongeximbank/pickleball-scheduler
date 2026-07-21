# 08 — Staging Preflight and Rollout Plan (Phase 1H-A)

## Scripts

| Script | Path | Phase 1H-A mode |
|--------|------|-----------------|
| Preflight | `scripts/crm/phase-1h-staging-preflight.mjs` | Offline/static only |
| Apply boundary | `scripts/crm/phase-1h-staging-apply.mjs` | Dry-run default; apply refused |

## Offline preflight checks

- Environment assertion = `staging`
- Production project refs blocklisted (`expuvcohlcjzvrrauvud`)
- Required migration files exist + SHA match
- Optional `--rollout-mode` fails on uncommitted migration changes
- Required env var **names** listed; values never printed
- Owner approval / backup evidence / permission seed approval markers present as design flags
- Tenant/venue resolver verdict acceptable
- RLS/RPC certification docs exist
- Durable runtime remains off (`memory` default)

## Future apply boundary (not executed in 1H-A)

Requires all of:

- `--apply-staging`
- `--owner-approval=` matching `CRM_STAGING_OWNER_APPROVAL`
- `--backup-evidence=` matching `CRM_STAGING_BACKUP_EVIDENCE`
- `--environment=staging`
- SHA-pinned sequence
- Stop on first error
- No Production continuation
- No deploy
- No credential logging
- No automatic rollback
- Evidence report JSON

Phase 1H-A **hard-refuses** apply even if flags are present.

## Controlled rollout plan (future 1H-B)

1. Owner signs permission seed + role matrix docs
2. Backup/restore evidence recorded
3. Offline preflight green in rollout mode
4. Dry-run apply report reviewed
5. Apply Staging with stop-on-first-error
6. Post-apply QA matrix (doc 09)
7. Keep app durable runtime **off** until separate Owner switch approval
8. Rollback: manual only per migration rollback classification — no best-effort auto rollback

## Rollback sketch

| Object class | Rollback |
|--------------|----------|
| Role grants | DELETE matching `role_permissions` CRM rows |
| Permission catalog | DELETE `permissions` where `module = 'crm'` only if unused |
| Consent trigger | DROP trigger/function |
| Grants | REVOKE authenticated; do not GRANT PUBLIC |
| RPCs | DROP FUNCTION |
| Policies | DROP POLICY; keep RLS enabled if possible |
| Tables | DROP TABLE — destructive; last resort |

Never weaken RLS during rollback.
