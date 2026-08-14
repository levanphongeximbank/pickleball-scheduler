# team-tournament-staging-acceptance-remediation-01

**LOCAL PACKAGE ONLY. Do NOT apply without Owner GO.**

PR #425 Staging acceptance blockers:

| ID | Defect |
|----|--------|
| B01 | Header rename wrote `team_tournaments.name` only — `canonical_tournaments.name` stayed stale |
| B02 | Owner Team AI pairing called Super Admin `private_pairing_get_active_rules_for_scope` → `PERMISSION_DENIED` before `team_tournament_commit_pairing` |

## Identity contract (unchanged)

```text
canonical_tournaments.id = team_tournaments.tournament_id
```

`team_tournaments.id` is an internal header PK. Public lookup must not require header PK equality.

## A — Canonical name synchronization

Authoritative rename:

```text
team_tournament_rename(p_tournament_id, p_name)
```

One SECURITY DEFINER transaction writes:

- `canonical_tournaments.name` keyed by `canonical.id = header.tournament_id`
- `team_tournaments.name` keyed by header row (`id` + `tournament_id`)

Triggers keep either-direction updates in sync after apply.

Client:

- `cloudTournamentRepository.update` calls `team_tournament_rename` for Team Tournament name patches
- `cloudEnsureTournamentHeader` does **not** overwrite name on existing header rows
- No client dual-write, no localStorage authority, no historical backfill

After sync, dashboard (`v_header.name`), list (`tt.name`), setup/F5 (`canonical.name`) resolve the same visible name.

## B — Opaque Owner pairing runtime

Owner / `VENUE_OWNER` / `COURT_OWNER` / `TENANT_OWNER` still **do not** receive:

- `pairing.private_rules.view`
- `pairing.private_rules.manage`
- `pairing.private_rules.audit`
- `pairing.private_rules.simulate`

Team AI path:

```text
Owner → Ghép đội → generate MLP candidates (no rule payload)
      → team_tournament_form_pairing_opaque
      → internal private_pairing_load_active_rules_internal (not granted)
      → sanitized teams + opaque metadata
      → captain/group preview
      → team_tournament_commit_pairing
```

Internal loader is **not** granted to `anon` / `authenticated`.
`PERMISSION_DENIED` is **not** converted to empty rules.
Missing opaque RPC is fail-closed (`RPC_MISSING`).

Owner-visible generic codes only:

- `PAIRING_RULE_CONSTRAINT_UNSATISFIED`
- `NO_FEASIBLE_PAIRING`
- `PAIRING_SEARCH_LIMIT_REACHED`

SUPER_ADMIN `private_pairing_get_active_rules_for_scope` remains permission-gated.

## Apply order (Owner GO only)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql`
3. `03_VERIFY.sql`

Rollback: `04_ROLLBACK.sql` drops package-owned functions/triggers only.
Does not drop `team_tournament_commit_pairing` or PR #423 referee RPCs.

## Locked SHA256 (LF)

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `b56de7e2cad2e9d9e52080263611b5f73f09154525665f1556b1c9e06c4d46b1` |
| `02_APPLY.sql` | `b6f50955565d2512554d06e2f39261a3f3bbda3abe375ca6d865b6d243469555` |
| `03_VERIFY.sql` | `34bf83354e59ed550c7d3b1b13aa9059b095f654c2917666a6dd5856b649e805` |
| `04_ROLLBACK.sql` | `46980f70046fdd7b1d4ca0121574566740db399f26807841372b2bb8acac67e0` |

## Safety

- No Staging/Production apply in the implementation turn
- Does not modify PR #425
- Does not grant Owner private-rule permissions
- Does not backfill historical tournament names
