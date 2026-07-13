# TT-5D Assignment Security

## Scope fields (`referee_assignments`)

- `tenant_id`, `tournament_id`, `match_id` (= `referee_match_id` = `external_sub_match_id`)
- `matchup_id`, `sub_match_id`, `external_matchup_id`, `external_sub_match_id`
- `referee_user_id`, `status`, `assigned_at`, `expires_at`
- `revoked_at`, `revoked_by`, `revoke_reason`, `version`

## Effective status (server time)

`referee_v5_assignment_effective_status()` → `pending` | `active` | `expired` | `revoked` | `completed`

Expired active rows are marked via `referee_v5_mark_assignment_expired_if_needed()`.

## Error codes

| Code | Meaning |
|------|---------|
| `referee_assignment_expired` | Write blocked after expiry |
| `referee_assignment_revoked` | BTC revoked assignment |
| `REFEREE_NOT_ASSIGNED` | Wrong user / no assignment |
| `cross_tenant_denied` | Tenant mismatch |

## RPCs

- `team_tournament_create_referee_assignment`
- `team_tournament_revoke_referee_assignment`
- `team_tournament_list_referee_assignments`
- `team_tournament_referee_match_access_ops`
