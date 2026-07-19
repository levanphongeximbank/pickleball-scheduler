# CORE-01 — Authority and Precedence

**SSOT:** `src/features/competition-core/constraints/authority/`

## Canonical source ladder

| Source | Priority |
|--------|----------|
| SUPER_ADMIN | 1000 |
| TOURNAMENT | 800 |
| CLUB | 600 |
| SESSION | 400 |
| DEFAULT | 0 |

## Deterministic comparator (mandatory order)

1. `sourcePriority` **DESC**
2. rule `priority` **DESC** (`low` &lt; `medium` &lt; `high` &lt; `critical`)
3. `ruleSetVersion` **DESC** (numeric: `10` beats `2`)
4. `updatedAt` **DESC** (`Date.parse`; invalid → `0`)
5. `id` **ASC** (UTF-16 code-unit order; lower id wins)

`CONSTRAINT_SCOPE` is a **domain evaluation scope**, not an authority tier.
It must **never** participate in the authority comparator.

No randomness. No reliance on array insertion order, object key iteration order, or locale-sensitive string compare.

## API

- `RULE_SOURCE`, `RULE_SOURCE_PRIORITY`
- `normalizeRuleAuthority(rule)`
- `compareRuleAuthority(a, b)` → `>0` when `a` outranks `b`

## Private Pairing parity

Numeric priorities match `PRIVATE_PAIRING_SOURCE_PRIORITY`.
Phase 1 keeps PP code untouched; a later PR will switch PP to import these canonical symbols.
