# V5-A — Permission Matrix

| Action | PLAYER | CLUB_MANAGER | COACH | TOURNAMENT_MANAGER | SUPER_ADMIN |
|--------|:------:|:------------:|:-----:|:------------------:|:-----------:|
| `rating_v5.view_own` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `rating_v5.assess_self` | ✅ | — | — | — | ✅ |
| `rating_v5.submit_match` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `rating_v5.confirm_match` | ✅ | ✅ | — | ✅ | ✅ |
| `rating_v5.submit_evidence` | ✅ | ✅ | ✅ | — | ✅ |
| `rating_v5.review_evidence` | — | ✅ | ✅ | ✅ | ✅ |
| `rating_v5.override` | — | — | — | — | ✅ |
| `rating_v5.view_any` | — | — | — | ✅ | ✅ |

## RPC enforcement

| RPC | Auth | Idempotent | Client fields accepted | Server computes |
|-----|------|:----------:|------------------------|-----------------|
| `rating_v5_submit_answer` | self | per assessment+question | questionId, answerIndex | next question |
| `rating_v5_complete_assessment` | self | per assessmentId | assessmentId | skill_vector, provisional, gates |
| `rating_v5_get_profile` | self | yes | ratingMode | display_rating, reliability |
| `rating_v5_submit_match_result` | participant | per matchId | teams, scores, source | — (V5-D) |
| `rating_v5_confirm_match` | participant | per matchId+player | confirm boolean | evidence level 3 |
| `rating_v5_review_evidence` | reviewer role | per evidenceId | decision, note | verified track update |
| `rating_v5_override` | super_admin | per caseId | reason (required) | override + audit |

## Forbidden for all client roles

```
rating_mean, verified_rating, rating_status, evidence_level,
reliability_score, skill_vector, applied_gates, rating_delta
```

Enforced by: `ratingPayloadGuard.js` + RLS + RPC validation.
