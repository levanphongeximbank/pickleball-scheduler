# 04 — Canonical Table Options

## OPTION A — Extend `profiles`

**Idea:** Additive columns on existing auth-linked person row.

| Criterion | Assessment |
|-----------|------------|
| Identity ownership clarity | Medium — hybrid continues; mitigate via write API ownership |
| Player Management ownership | Good if only `updatePlayerProfile` writes Player fields |
| Migration complexity | **Low** — ALTER TABLE additive |
| RLS complexity | **Low** — reuse + narrow column grants via guard/allowlist |
| Backward compatibility | **High** — birth_year/gender unchanged |
| Dual-write risk | Medium until Identity self-demographics cut over |
| FK design | None new for person key |
| API compatibility | High |
| Future public profile | Needs projector (already planned Phase 1E) |
| Dedupe/linking | Uses existing `player_id` alias |
| Rollback | Drop columns / null out |
| Operational risk | **Lowest** for this wave |
| Non-auth players | **Not covered** for durable storage |

## OPTION B — Create `player_profiles`

**Idea:** New table keyed by canonical `player_id` (text), optional `auth_user_id`.

| Criterion | Assessment |
|-----------|------------|
| Identity ownership clarity | **High** — clean separation |
| Player Management ownership | **Highest** |
| Migration complexity | **High** — new table, RLS, backfill, join path |
| RLS complexity | **High** — new policies + join to profiles/membership |
| Backward compatibility | Harder — birth_year already on profiles |
| Dual-write risk | **Highest** during coexistence with profiles.gender/birth_year |
| FK design | Need careful link to auth/profiles without second person |
| Non-auth support | **Best** long-term |
| Rollback | Drop table (but dual-write cleanup hard) |
| Operational risk | Higher |

## Recommendation

| Role | Option |
|------|--------|
| **Recommended (this wave)** | **A — extend profiles** |
| **Rejected (this wave)** | **B — player_profiles** |

### Reject B now because

1. Would split demographics across `profiles.birth_year`/`gender` and new table without completing Identity cutover.  
2. RLS + admin/list RPCs + `platform_resolve_athlete_profile` all assume profiles person payload today.  
3. Higher dual-write and rollback risk than additive columns.  
4. Non-auth durable need is real but **not blocking** auth-linked Phase 1C foundation; defer to a later “player_profiles for non-auth / full SSOT” phase with explicit Owner approval.

### Revisit B when

- Non-auth durable profiles become P0, **and**  
- `gender`/`birth_year` are fully owned by Player write path with Identity mirror removed or strictly mirrored.
