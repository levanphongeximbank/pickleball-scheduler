# CC-10 Stage 1 — Flag Snapshot

## Before (Staging Vercel)

| Flag | Value |
|---|---|
| All `VITE_COMPETITION_CORE_*` | **NOT CHANGED** (agent could not apply Vercel env) |

## Recommended Stage 1 SHADOW configuration

| Flag | Recommended |
|---|---|
| `VITE_COMPETITION_CORE_ENABLED` | `true` |
| `VITE_COMPETITION_CORE_RULES_V2_ENABLED` | `true` |
| `VITE_COMPETITION_CORE_DRAW_V2_ENABLED` | `true` |
| `VITE_COMPETITION_CORE_FORMATION_V2_ENABLED` | `true` |
| `VITE_COMPETITION_CORE_MATCHMAKING_V2_ENABLED` | `true` |
| `VITE_COMPETITION_CORE_STANDINGS_V2_ENABLED` | `true` |
| `VITE_COMPETITION_CORE_SCHEDULING_V2_ENABLED` | `true` |
| `VITE_COMPETITION_CORE_RATING_V2_ENABLED` | `true` (DB prereqs pass) |
| Execution mode | `SHADOW` (not `CANONICAL_PRIMARY`) |

## After

**NOT CHANGED** — awaiting owner/Vercel apply after push.

## Production

All Competition Core flags remain **OFF**. No production env mutation.
