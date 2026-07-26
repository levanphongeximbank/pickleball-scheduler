# BM-FINAL-RATING-01 — Canonical SSOT Decision

**Status:** Owner-approved architecture decision (Phase B implementation)

## Canonical writable SSOT

| Layer | Path / authority |
|-------|------------------|
| Domain | `src/features/player-rating/foundation/**` |
| Persistence | Existing V5 durable service RPC / storage |
| Tables | `player_rating_profiles`, `player_rating_events`, `rating_snapshots`, `rating_v5_idempotency` |

## Classification

| Surface | Role |
|---------|------|
| `player-rating/foundation/**` | Canonical domain, read/write facade, ownership boundary |
| `pick-vn-rating/**` | Compatibility UI layer — not writable rating owner |
| `pick-vn-rating-v5/**` | Durable persistence + assessment behind foundation ports |
| Competition Elo | Internal competition signal — not public Player Rating |
| Local assessment storage | Draft / local-only — not canonical rating persistence |
| Club blob rating fields | Compatibility mirror — not independent writer / SSOT |

## Non-claims

- Does **not** enable `VITE_PICK_VN_RATING_V5_ENABLED`.
- Does **not** declare Production cutover.
- Does **not** invent new database schema.
