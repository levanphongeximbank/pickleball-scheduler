# team-tournament-close-uuid-type-remediation-01

**LOCAL PACKAGE ONLY. Do NOT apply to Staging/Production without Owner GO.**

**Forward-only after `team-tournament-post-lineup-complete-lifecycle-01`.**
**NEVER re-run lifecycle `02_APPLY.sql`.**
**NEVER re-run `team-tournament-owner-browser-acceptance-remediation-01`.**

## Why

Owner Scenario A close fails on Staging with:

```text
operator does not exist: uuid = text
```

Root cause is the dual-write in `team_tournament_close_tournament`:

```sql
update public.canonical_tournaments
   set status = 'completed',
       updated_at = v_now
 where id = v_header.tournament_id
    or id = p_tournament_id;
```

Types:

| Expression | Type |
|------------|------|
| `canonical_tournaments.id` | `uuid` (EXPECTED_CANONICAL_TYPE) |
| `v_header.tournament_id` | `text` |
| `p_tournament_id` | `text` |

Dashboard already uses safe `t.id::text = p_tournament_id`. Canonical tournament_* RPCs take `uuid` params — OK. Only this close dual-write compares uuid to text.

## Fix (APPLY)

`CREATE OR REPLACE` `team_tournament_close_tournament` with the current lifecycle close body **except** the dual-write WHERE becomes:

```sql
where id = nullif(btrim(coalesce(v_header.tournament_id, '')), '')::uuid
   or id = nullif(btrim(coalesce(p_tournament_id, '')), '')::uuid
   or external_key = nullif(btrim(coalesce(v_header.tournament_id, '')), '')
   or external_key = nullif(btrim(coalesce(p_tournament_id, '')), '');
```

## Preserved contracts

- `team_tournament_assert_close_readiness` gate (unchanged body)
- Champion from readiness only (`CHAMPION_UNRESOLVED` if missing)
- Client `summary` / `awardsSheet` / `frozenStandings` / `championTeamId` discarded (`CLIENT_RESULT_PAYLOAD_TRUSTED_AS_AUTHORITY=NO`)
- `team_tournaments.status = 'completed'` + settings closing metadata
- Dual-write `canonical_tournaments.status = 'completed'`
- Grants: `authenticated` execute only (revoke public/anon)

## Explicit non-goals

- Do **not** re-run lifecycle-01 or owner-browser-acceptance-01
- Do **not** mutate Owner fixture `8a6fff3b-9ec2-4d0e-aa55-c8d85b1c51ce` during package authoring
- Do **not** change readiness / auth / champion authority contracts
- Do **not** apply to Production

## Apply order (Owner GO only)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql` **once**
3. `03_VERIFY.sql` (disposable rows; must clean to zero `verify-close-uuid-%`)
4. Keep `04_ROLLBACK.sql` for emergency only

## Package LF SHA256 lock

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `bdbfdb97eda7704106ae1444ece83b6aeeab086656d2d04184070745c33d7d51` |
| `02_APPLY.sql` | `3235f8e768800cc1eff209423815d331fbcb41baa6743209888a0b4db1823ca4` |
| `03_VERIFY.sql` | `72fcbeb5944a847bdea16b7d29a849b3b2b7c9920a0c88fd28cd5322f20a64b8` |
| `04_ROLLBACK.sql` | `6c837b9b57c73f31b8e10170f6fee661ed33ba821936530e8b5f1471948cbc15` |

## Safety

- Owner GO required
- STAGING_MUTATIONS=0 for this authoring pass (package created locally only)
- PRODUCTION_MUTATIONS=0
- See `EVIDENCE.md`
