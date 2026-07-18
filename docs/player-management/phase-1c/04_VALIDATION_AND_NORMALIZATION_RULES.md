# 04 — Validation and Normalization Rules

| Rule | Behavior |
|------|----------|
| Invalid date format | Reject (`INVALID_BIRTH_DATE_FORMAT`) |
| Impossible date | Reject (`IMPOSSIBLE_BIRTH_DATE`) |
| Future birthDate | Reject vs reference date (`FUTURE_BIRTH_DATE`) |
| birthDate/birthYear conflict | Reject (`BIRTH_DATE_YEAR_CONFLICT`) |
| birthYear alone | Allowed; does **not** invent birthDate |
| birthDate alone | Derives birthYear on write for consistency |
| Unsupported handedness | Reject when strict |
| Invalid region shape / ranking mock | Reject |
| Invalid privacy non-boolean | Reject |
| Rating verification as identity | Reject (`RATING_VERIFICATION_NOT_ALLOWED`) |
| Empty patch | Reject |
| Non-owned fields | Reject (`FORBIDDEN_FIELD`) |
| INVALID/UNMAPPED/AMBIGUOUS identity | Reject write |

Gender remains `male` \| `female` \| `unknown`.
