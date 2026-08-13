# Evidence — team-tournament-close-uuid-type-remediation-01

## Authoring pass

- Worktree: `team-tournament-post417-regression-closure-01`
- Package path: `docs/v5/migrations/team-tournament-close-uuid-type-remediation-01/`
- STAGING_APPLY=NO (package authored locally only)
- PRODUCTION_MUTATIONS=0
- Previously applied packages **not edited** (lifecycle-01, owner-browser-acceptance-01 untouched)

## Proven Staging failure

Owner real-browser Scenario A close fails with:

```text
operator does not exist: uuid = text
```

Failing expression in live Staging `team_tournament_close_tournament`:

```sql
update public.canonical_tournaments
   set status = 'completed',
       updated_at = v_now
 where id = v_header.tournament_id
    or id = p_tournament_id;
```

### Types (Staging information_schema, read-only)

| Object | Type |
|--------|------|
| `canonical_tournaments.id` | `uuid` (EXPECTED_CANONICAL_TYPE) |
| `canonical_tournaments.external_key` | `text` |
| `team_tournaments.tournament_id` | `text` |
| `team_tournaments.id` | `uuid` |
| `p_tournament_id` (RPC arg) | `text` |
| `v_header.tournament_id` | `text` (from `team_tournaments` row) |

Same-family callers already safe:

- Dashboard: `t.id::text = p_tournament_id`
- Canonical tournament_* RPCs: uuid params

## Owner fixture (not mutated)

| Field | Value |
|-------|-------|
| tournament_id | `8a6fff3b-9ec2-4d0e-aa55-c8d85b1c51ce` |
| team_tournaments.id | `76183930-d654-497f-b85d-374e17dbafda` |
| name | Giải đồng đội 12/8/2026 |
| status at evidence capture | `draft` (not closed; close blocked by uuid=text) |

This authoring pass did **not** UPDATE/DELETE the Owner fixture. VERIFY uses disposable `verify-close-uuid-%` rows only.

## Remediation

`02_APPLY.sql` replaces only the dual-write WHERE with nullif/btrim/`::uuid` plus `external_key` text match. All other close contracts remain identical to lifecycle-01 close body.

## Forward-only rules

- Never re-run `team-tournament-post-lineup-complete-lifecycle-01/02_APPLY.sql`
- Never re-run `team-tournament-owner-browser-acceptance-remediation-01`
- Owner GO required before Staging apply of this package
