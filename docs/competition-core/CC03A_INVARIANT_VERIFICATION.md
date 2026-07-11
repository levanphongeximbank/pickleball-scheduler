# CC-03A-V — Invariant Verification

**Phase:** CC-03A-V | **Date:** 2026-07-12

---

## 1. Hard / soft invariants

| Invariant | Verified |
|-----------|----------|
| HARD fail → `feasible: false` | ✅ |
| Soft score cao không cứu hard-failed candidate | ✅ (`softScore: 0` when hard fail) |
| SOFT-only không làm `feasible: false` | ✅ |
| Rule không applicable → skipped (không pass/fail giả) | ✅ |
| Invalid HARD params → conflict/validation error | ✅ |
| Duplicate constraint ID → deterministic conflict | ✅ |

---

## 2. Mutation / purity

| Check | Verified |
|-------|----------|
| `candidate` input không bị mutate | ✅ |
| `context` input không bị mutate | ✅ |
| `ruleSet` input không bị mutate | ✅ |
| Cùng input + ruleset → cùng output | ✅ |
| Không Supabase / fetch / localStorage trong constraints | ✅ |

---

## 3. Import side effects

| Check | Verified |
|-------|----------|
| Import `competition-core/index.js` không throw | ✅ |
| Constraints module không gọi legacy engine | ✅ |
| Không network/database side effect at import | ✅ |

---

## 4. Rule-set version (domain contract)

| Check | Verified | Notes |
|-----------|----------|-------|
| Chọn version mới nhất effective | ✅ | `selectRuleSetVersion` |
| Bỏ archived | ✅ | |
| Bỏ future `effectiveFrom` | ✅ | UTC ISO |
| Locked ruleset readable | ✅ | `validateRuleSetLifecycle` ok |
| Không catalog phù hợp → `null` | ✅ | Error envelope deferred (no persistence layer) |
| Locked ruleset mutate prevention | **Deferred** | No mutation service in CC-03A |

---

## 5. Context boundary

| Dimension | Skip when mismatch |
|-----------|-------------------|
| tenant | ✅ |
| tournament | ✅ |
| event | ✅ |
| venue | ✅ |
| competitionType | ✅ |
| gender | ✅ |
| ageGroup | ✅ |
| skillMin/Max | ✅ |
| effectiveFrom/effectiveTo | ✅ UTC ISO |

Không fetch context từ database trong pure engine ✅

---

## 6. Explainability

Hard fail / conflict explanations require:

- `reasonCode`, `title`, `message`, `severity`, `suggestedResolution` ✅
- `affectedPlayers` when applicable ✅

Soft notes include score breakdown component + message ✅

---

## 7. Test file

`tests/competition-core-rules-engine-verification.test.js` — **24 cases, 24 pass**

---

## Verdict

**PASS** — all CC-03A-V invariants verified.
