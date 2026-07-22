# 08 — Staging Preflight and Rollout Plan (Phase 1H-A)

## Scripts

| Script | Path | Phase 1H-B mode |
|--------|------|-----------------|
| Preflight | `scripts/crm/phase-1h-staging-preflight.mjs` | Offline/static + optional `--live-gates` |
| Apply boundary | `scripts/crm/phase-1h-staging-apply.mjs` | Dry-run default; live apply only after all Owner gates |

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

## Controlled apply boundary (Phase 1H-B)

Requires all of:

- `--apply-staging`
- `--owner-approval=` matching `CRM_STAGING_OWNER_APPROVAL`
- `--backup-evidence=` matching `CRM_STAGING_BACKUP_EVIDENCE`
- `--permission-seed-approval=` matching `CRM_IDENTITY_PERMISSION_SEED_APPROVAL`
- `--phase-1g-apply-approval=` matching `CRM_PHASE_1G_PERSISTENCE_APPLY_APPROVAL`
- `--role-matrix-approval=` matching `CRM_IDENTITY_ROLE_MATRIX_APPROVAL` **or** `--defer-role-matrix`
- `--environment=staging`
- Proven Staging allowlisted project identity
- Backup evidence path marker
- SHA-pinned sequence re-verified immediately before write
- Stop on first error
- No Production continuation
- No deploy
- No credential logging
- No automatic rollback
- Sanitized evidence JSON under `docs/crm/phase-1h-b/`

Missing any required gate → refuse with `CRM_PHASE_1H_B_BLOCKED_*` (no SQL write).

## Controlled rollout plan

1. Owner signs permission seed + role matrix (separate tokens)
2. Backup/restore evidence recorded
3. Offline preflight green; `--live-gates` green
4. Dry-run apply report reviewed
5. Apply Staging with stop-on-first-error
6. Post-apply QA matrix (doc 09 + phase-1h-b evidence 05–08)
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
