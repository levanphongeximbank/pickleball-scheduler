# CC-07 Error Model

| Code | Meaning |
|------|---------|
| `rules_v2_mapping_error` | Legacy payload could not map |
| `rules_v2_context_missing` | Required context absent |
| `rules_v2_conflict` | Constraint conflict |
| `rules_v2_evaluation_failed` | Generic evaluation failure |
| `rules_v2_unsupported_legacy_rule` | Hard legacy rule not supported |
| `rules_v2_duplicate_decision` | Duplicate side effect |
| `rules_v2_double_count_detected` | Soft score double applied |

Hard failures never fall back to soft acceptance.
