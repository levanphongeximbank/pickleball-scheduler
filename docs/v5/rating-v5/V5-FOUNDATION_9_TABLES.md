# V5 Foundation — 9 Table Registry

**Canonical list** (staging migration 9/9). Source: `src/features/pick-vn-rating-v5/constants/v5TableRegistry.js`

| table_name | purpose | write authority | RLS mode | append-only | shadow impact |
|------------|---------|-----------------|----------|-------------|---------------|
| player_rating_profiles | V5 canonical rating profile per player/mode | service RPC / rating_v5_complete_assessment | SELECT own/reviewer; writes denied | no | is_shadow=true default |
| player_skill_assessments | Questionnaire sessions | PLAYER draft; complete via RPC | SELECT own/reviewer; draft insert/update no computed fields | no | is_shadow=true default |
| player_rating_events | Append-only rating ledger | engine RPC only | SELECT own/reviewer; writes denied | **yes** | is_shadow=true default |
| rating_evidence | Evidence submissions | PLAYER insert level≤3 | SELECT own; INSERT pending; UPDATE denied | no | is_shadow=true default |
| rating_snapshots | Profile snapshots | service_role only | ALL denied to authenticated | no | is_shadow=true default |
| rating_review_cases | Anomaly review workflow | reviewer RPC only | SELECT own/reviewer; write denied | no | is_shadow=true default |
| rating_calibration_versions | Calibration parameters | calibration_manage | SELECT pilot/approved; write manage | no | none |
| rating_v5_rollout_config | Shadow/pilot flags | calibration_manage | SELECT authenticated; write manage | no | shadow defaults |
| rating_v5_idempotency | RPC idempotency keys | service RPC only | ALL denied | no | none |

**V2 coexistence:** `pick_vn_player_ratings` is separate and untouched.
