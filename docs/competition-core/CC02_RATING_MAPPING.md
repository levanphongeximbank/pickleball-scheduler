# CC-02 — Elo ↔ Skill Mapping

**Phase:** CC-02 | **Mapping version:** `v1`

---

## 1. Functions

| Function | Location |
|----------|----------|
| `mapCompetitionEloToSkill(elo, options)` | `rating/mapCompetitionEloToSkill.js` |
| `mapSkillToCompetitionElo(skill, options)` | same file |
| `detectRatingStorageScale(value)` | same file |

---

## 2. Mapping v1 formula

**Anchor:**

```text
publicSkillLevel 3.5 ↔ competitionElo 1500
1.0 skill step ↔ 400 Elo points
```

**Forward (Elo → skill):**

```text
estimatedSkillLevel = clamp(3.5 + (competitionElo - 1500) / 400, 1.0, 8.0)
```

**Inverse (skill → Elo):**

```text
competitionElo = round(1500 + (skillLevel - 3.5) * 400)
```

---

## 3. Output shape

```javascript
{
  estimatedSkillLevel: 3.75,
  confidence: 72,        // 0–100
  mappingVersion: "v1"
}
```

---

## 4. Confidence input

Accepts `0–1` (Pick_VN blob) or `0–100` (CC-02 target). Normalized to `0–100` in output.

---

## 5. Boundary tests

| competitionElo | estimatedSkillLevel |
|----------------|---------------------|
| 1500 | 3.5 |
| 1700 | 4.0 |
| 1300 | 3.0 |
| 100 | 1.0 (clamped) |
| 5000 | 8.0 (clamped) |

---

## 6. Future versioning

`mappingVersion` allows tenant/season-specific curves in CC-03+ without breaking v1 reads.

**Do not** compare raw values:

```javascript
// WRONG
if (competitionElo >= publicSkillLevel + 0.35)

// CORRECT
const { estimatedSkillLevel } = mapCompetitionEloToSkill(competitionElo, { confidence });
if (estimatedSkillLevel >= publicSkillLevel + promoteThreshold)
```
