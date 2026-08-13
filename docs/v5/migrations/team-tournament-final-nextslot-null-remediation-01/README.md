# team-tournament-final-nextslot-null-remediation-01

**LOCAL PACKAGE ONLY. Do NOT apply to Staging/Production without Owner GO.**

**Forward-only.** NEVER re-run:

- `team-tournament-scenario-b-final-progression-referee-01`
- `team-tournament-scenario-b-ko-lineup-remediation-01`
- `team-tournament-close-uuid-type-remediation-01`

## Why

Prior package VERIFY passed on disposable fixtures that persisted `nextSlot`.
Owner Scenario B historical semifinals have `nextSlot = NULL`.

SQL used `v_slot not in ('A','B')`. SQL NULL does **not** evaluate TRUE, so
`matchNumberInRound` fallback was skipped. Both completed SF winners wrote
Final slot A.

Current Owner Final `ko-mugj641t`: `team_a=team-eixvc6s8`, `team_b=EMPTY`.
Final remains operationally inert (both teams not resolved).

## Canonical slot contract

ONE resolver: `team_tournament_resolve_knockout_next_slot` (SQL) /
`resolveKnockoutNextSlot` (JS).

1. Explicit valid `A` or `B` → use it.
2. NULL / blank / invalid → `matchNumberInRound` (`1 → A`, `2 → B`).
3. Two SF predecessors must not target the same Final slot.
   Collision remaps by match number order.

## Fix (APPLY)

1. Replace `team_tournament_advance_knockout_winner` to call the NULL-safe resolver
   (`IS DISTINCT FROM`, never `NOT IN` on nullable text).
2. Stamp resolved `nextSlot` onto historical predecessor rows.
3. `team_tournament_reconcile_knockout_progression` overwrites a wrong partial
   Final from canonical SF winners (does not preserve incorrect `team_a`).
4. One-time reconcile of existing completed KO rows.

Does **not** modify SF/group results. Does **not** create Final lineups.
Does **not** create a duplicate Final.

## Owner B expected after later GO

| Slot | Source | Team |
|------|--------|------|
| Final A | SF1 `ko-7ebydj8c` match #1 winner | `team-8xqls8it` |
| Final B | SF2 `ko-fttp83ax` match #2 winner | `team-eixvc6s8` |

## Apply order (Owner GO only)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql` **once**
3. `03_VERIFY.sql`
4. `04_ROLLBACK.sql` emergency only (keeps NULL-safe resolver)

## Package LF SHA256 lock

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `b450807dd77079e91265cf443cdf9386c897f354607fb8088b6a395459343c43` |
| `02_APPLY.sql` | `acbeb5894cb87a312d37be2c3a65f3630d518387c95cd4b71cfcc6ef4a2fbc5a` |
| `03_VERIFY.sql` | `7111fcf1bf0ab9f534277a9fe95338a3dd235f988732a9e6f5e5929f53a1dda3` |
| `04_ROLLBACK.sql` | `1c9ef6993033def637b5e8060da24d7a95aef6565d35f5ba3928cfa066be7954` |
