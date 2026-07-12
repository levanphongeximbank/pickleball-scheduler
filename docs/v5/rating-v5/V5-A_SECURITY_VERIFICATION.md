# V5-A — Security Verification

## Threat model

| Threat | Mitigation | Verified by |
|--------|------------|-------------|
| Client sets `verified_rating` | Forbidden fields + RLS no profile write | Unit test + SQL policy |
| Client sets `rating_status=verified` | Same | Unit test |
| Assessment overwrites verified | RPC only updates provisional; verified column separate | SQL schema + test |
| User A edits Player B | `auth.uid() = player_id` on all policies | SQL + test |
| Locked match edit triggers rating | Event idempotency + hold on anomaly (V5-E) | Design + future test |
| Rating event UPDATE/DELETE | DB trigger raises exception | SQL trigger |

## Client guard tests

```javascript
validateClientRatingPayload({ ratingMean: 4.5 }) → FORBIDDEN_RATING_FIELDS
validateAssessmentInputPayload({ questionId: 'x', answerIndex: 3 }) → OK
stripForbiddenRatingFields({ ratingMean: 4, questionId: 'q' }) → { questionId: 'q' }
```

## Display rating integrity

```javascript
// WRONG (V2 pattern): rating * reliability
// RIGHT (V5):
resolveDisplayRating({ verifiedRatingMean: 3.7, reliabilityScore: 42 })
// → { ratingMean: 3.7, displaySource: 'open_match_rating' }  // reliability < 70
```

## SQL controls (draft)

- `player_rating_profiles`: `using(false)` for ALL writes
- `player_skill_assessments`: INSERT requires null computed fields
- `player_rating_events`: INSERT `with check(false)` for clients; trigger blocks UPDATE/DELETE
- `rating_evidence`: INSERT pending only; `verified_by` null

## Not yet verified (requires staging apply)

- RPC role checks under real RBAC
- PostgREST direct table access penetration test
- RLS policy integration with tenant isolation
