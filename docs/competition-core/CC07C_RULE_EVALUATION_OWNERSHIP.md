# CC-07C — Rule Evaluation Ownership

When `VITE_COMPETITION_CORE_RULES_V2_ENABLED=true` (and master core ON):

| Owner | Responsibility |
|---|---|
| `CANONICAL` | Mapped founder hard/soft partner rules |
| `LEGACY_FALLBACK` | Unsupported soft rules explicitly marked fallback |
| `NON_RULE_SCORING` | Level, history, waiting weights (unchanged) |
| `UNSUPPORTED_HARD` | Unmapped hard rules → runtime error / review |
| `SKIPPED_DUPLICATE` | Second adapter mapping of same deduplication key |

Helper: `resolveRuleEvaluationOwner()` in `ruleEvaluationOwnership.js`.

Flag OFF: legacy scoring owns all policy contributions; deduplication plan is inert.
