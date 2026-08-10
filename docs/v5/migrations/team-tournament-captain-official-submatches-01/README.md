# team-tournament-captain-official-submatches-01

**Workstream:** `TEAM-TOURNAMENT-PR412-CAPTAIN-OFFICIAL-SUBMATCH-READER-REMEDIATION-01`  
**Status:** PACKAGE LOCKED — **DO NOT APPLY** without Owner GO.  
**Scope:** Staging-only extension of `team_tournament_get_captain_portal` to return published `matchups[].subMatches`.

## Root cause

Canonical `public.team_tournament_sub_matches` already has 4 MLP4 rows after publish.  
Organizer `get_setup` embeds them; captain portal did not → empty “Cặp đấu chính thức”.

## Remediation

Replace only `public.team_tournament_get_captain_portal(text, integer)`:

- Keep viewerTeamId matchup scope
- Embed `subMatches` with get_setup **core** field parity:
  `id, disciplineId, sortOrder, status, score, winnerTeamId, resultConfirmedAt, version`
- **Backend publication gate:** non-`published`/`in_progress`/`completed` → `[]` (even if DB rows exist)
- No manage-only `*Ops` fields
- No get_setup restoration for captains
- No RLS/RBAC / lineup / publish semantic changes

## Locked SHA256

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `5247153192b6da9f22b3489747ee3a4f00fe6a51e329ba52329e493f8c2f97f0` |
| `02_APPLY.sql` | `4e7e4c6ca3c8f732dcc77fcff181b4436172dee6398b7e437bf044b818763498` |
| `03_VERIFY.sql` | `e17fc59eb91cd8b260a93f4f3d55adddbd70526fa5292c7261c20fee4a394c90` |
| `04_ROLLBACK.sql` | `e03864494d7c869eb524d98d1d699653f00425506981ed5e0eabb62495dccadc` |

## Apply order (Owner GO only)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql`
3. `03_VERIFY.sql`

Target fixture referenced in checks: `team-tournament-m6xorxy1` / `matchup-mj90tdx5`.
