# team-tournament-dashboard-draft-operational-role-visibility-01

LOCAL PACKAGE ONLY. Do **not** apply to Staging or Production without Owner GO.

## Why

Owner real-browser (TT412-SEED-M04) proved:

| Boundary | Result |
|----------|--------|
| Route auth `/tournaments/:id` | PASS (no `/discover-clubs`) |
| Dashboard RPC | FAIL `DRAFT_NOT_VISIBLE` → generic load error |

Root cause: `team_tournament_get_dashboard` denied `status=draft` **before** resolving captain/deputy/referee roles. Captain lineup runs while the tournament is still draft, so captains must discover tasks from Dashboard without a manually shared portal URL.

## Target contract (Owner-approved)

Draft is **not** visible to every athlete.

`can_view_dashboard` =
- `can_manage`
- OR athlete-visible status (`registration|ready|active|completed`)
- OR (`draft` AND operational role in **this** tournament)

Operational roles only: **captain**, **deputy**, **assigned referee**.

Ordinary team members and same-tenant nonparticipants stay `DRAFT_NOT_VISIBLE`. Cross-tenant fails closed. Engine / `tournament.update` unchanged.

## This package

1. `team_tournament_can_view_dashboard(status, can_manage, is_captain_or_deputy, is_assigned_referee)` — explicit decision helper.
2. `team_tournament_get_dashboard` — resolve captain/deputy + referee assignments **before** visibility; athletes.id identity first.
3. VERIFY — helper matrix + auth-simulated captain PASS / ordinary member DENY on Owner draft tournament `7d1fe5a0-…`.

## Apply order

1. `01_PRECHECK.sql` (fingerprint must match)
2. `02_APPLY.sql`
3. `03_VERIFY.sql`

Rollback: `04_ROLLBACK.sql` restores pre-apply dashboard body + drops helper.

## Locked SHA256

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `933e273b2cfcfa30e4b8710f5ebef6f3a2400ab3bbb2a2b2ca506087672252a2` |
| `02_APPLY.sql` | `cc059feb5f25c34f824d9233eee3128ec1095dead8926449150454b6815200a2` |
| `03_VERIFY.sql` | `3c0e7e9ee71ef896db59985920ce2796a8d85ca07d5a6bfe9ae38f711ef4ed80` |
| `04_ROLLBACK.sql` | `517aa6fde5eba6922491d3a5b163cdc25531db381b9325bb99a3c58f1d741ab9` |

## Pre-apply Staging fingerprint

| Function | md5(pg_get_functiondef) |
|----------|-------------------------|
| `team_tournament_get_dashboard(text)` | `306f3d55f27cc2ac1010b6ece771388b` |

## Safety

- No fixture mutation in APPLY
- No Production apply
- No Tournament Engine auth change
- Captain Save/Submit/F5 / gender / portal roster / #412–#418 preserved
