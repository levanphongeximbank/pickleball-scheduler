# V5-B.2 — Adaptive Assessment UI Architecture

**Phase:** UI wiring (Staging shadow pilot)  
**Route:** `/player/skill-assessment-v5`  
**Freeze:** assessment-v5.0f / qbank-v5.0f / scoring-v5.0f

---

## Canonical flow

```text
User answers (client)
  → local draft (resume only, no scores)
  → POST rating-v5-complete-assessment (4-field allowlist)
  → Edge trusted scoring
  → rating_v5_service_persist_assessment_completion
  → canonical response → results UI
```

V2 route `/player/skill-assessment` unchanged.

---

## Layer map

| Layer | Path | Role |
|-------|------|------|
| Feature flags | `config/flags.js`, `config/featureFlags.js` | `VITE_PICK_VN_RATING_V5_ENABLED` |
| Access gate | `services/ratingV5AccessService.js` | Flag + rollout config + cohort |
| Rollout | `services/ratingV5RolloutService.js` | `rating_v5_rollout_config` read |
| RPC | `services/ratingV5RpcService.js` | `rating_v5_start_assessment`, `rating_v5_get_profile` |
| Edge client | `services/ratingV5EdgeClient.js` | Strict 4-field complete payload |
| Draft | `storage/ratingV5DraftStore.js` | localStorage resume (no rating fields) |
| Session hook | `hooks/useV5AssessmentSession.js` | Core → adaptive → submit |
| UI groups | `constants/assessmentUiGroups.js` | 10 skill groups, 22 core IDs |
| Terminology | `constants/terminology.js` | `resolveQuestionDisplay`, glossary v5.0f |
| Adaptive routing | `assessment/adaptiveRouting.js` | `selectNextAdaptiveQuestion` (client path only) |
| Page | `pages/player/SkillAssessmentV5Page.jsx` | Access gate + workspace |
| Workspace | `components/V5AssessmentWorkspace.jsx` | Wizard + results |
| Results | `components/V5AssessmentResults.jsx` | Canonical server fields only |
| Shadow notice | `components/V5ShadowNotice.jsx` | Always visible on staging |
| Compare panel | `components/V5InternalComparePanel.jsx` | Owner/tech only |

---

## Access conditions

1. Authenticated user with player profile context
2. `VITE_PICK_VN_RATING_V5_ENABLED=true` (Staging only)
3. `rating_v5_rollout_config.allow_v5_assessment` + `shadow_mode_enabled`
4. User `rollout_cohort` matches `pilot_cohort_label` (or no profile yet)
5. `rating_mode = doubles` only

Singles → `SINGLES_NOT_IMPLEMENTED` (RPC + hook).

---

## Question structure

| Segment | Count |
|---------|-------|
| Core | 22 |
| Adaptive (max) | 8 |
| Session max | 30 |

Progress UI uses **skill groups**, not `1/52`.

---

## Payload contract (client → Edge)

```json
{
  "assessment_id": "uuid",
  "answers": { "core_exp_01": 3 },
  "rating_mode": "doubles",
  "assessment_version": "assessment-v5.0f"
}
```

Validated by `completeAssessmentPayloadGuard.js` on server.

---

## Draft contract (localStorage)

Allowed: `assessment_id`, `answers`, `current_step`, `answered_question_ids`, `adaptive_question_ids`, `question_order`, `started_at`, `assessment_version`, `question_bank_version`.

Forbidden: any rating/score fields.

Version mismatch → `VERSION_MISMATCH` → restart required.

---

## Navigation

Menu item `player-skill-assessment-v5` uses `requiresFeature: pickVnRatingV5` — hidden when flag off.

---

## Non-goals (V5-B.2)

- No Production deploy
- No V2 canonical change
- No VPR / seeding / matchmaking updates
- No singles / match engine
- Client does **not** compute official rating
