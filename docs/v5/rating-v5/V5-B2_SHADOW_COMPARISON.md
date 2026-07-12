# V5-B.2 — Shadow Comparison Panel

**Mode:** `shadow_mode_enabled = true`  
**Cohort:** `v5-shadow-pilot`

---

## Player-facing

- Shadow notice on every V5 assessment screen
- Results labeled **Provisional** / **Estimated** — never **Verified**
- V5 does not appear on VPR, seeding, matchmaking, or public production rating

---

## Internal compare (owner / technician)

Component: `V5InternalComparePanel.jsx`

Visible when role is `SYSTEM_TECHNICIAN`, `SUPER_ADMIN`, `CLUB_OWNER`, or RBAC `rating_v5.view_any`.

| Field | Source |
|-------|--------|
| V2 current rating | `pickVnRatingService` local / RPC read |
| V5 estimated rating | Edge canonical response |
| V5 provisional rating | Edge canonical response |
| Difference | V5 est − V2 |
| Confidence score | Edge response |
| Applied gates | Edge response |
| Seven version fields | `versions` block in response |

Controlled by `rating_v5_rollout_config.compare_v2_enabled` (read-only compare; no write-back).

---

## Isolation guarantees

| System | V5-B.2 impact |
|--------|----------------|
| `pick_vn_player_ratings` (V2) | No writes from V5 UI |
| VPR / seeding | Unchanged |
| Leaderboard (`is_shadow=false` index) | V5 profiles excluded |
| Production | Not deployed |
