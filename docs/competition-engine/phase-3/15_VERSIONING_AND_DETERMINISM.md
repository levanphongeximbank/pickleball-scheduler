# 15 — Versioning and Determinism

**Status:** Design only

---

## Version dimensions (separate)

| Dimension | Example | Purpose |
|-----------|---------|---------|
| Canonical contract version | `participant-contract@1.2` | DTO stability |
| Canonical executor version | `standings-exec@2.0` | Algorithm |
| Adapter version | `draw-adapter@1.4` | Mapping |
| Comparator version | `standings-cmp@1.1` | Parity rules |
| Persistence schema version | `cc-persist@0.3` | Tables/views |
| Runtime mode version | `runtime-mode@1` | State machine semantics |

Do **not** use one global `version` for all.

Supported coexistence during migration:

```text
Legacy executor v1
Canonical executor v1
Canonical executor v2
Adapter v1
Comparator v2
```

Parity records store all relevant versions.

---

## Non-determinism audit (Production today)

| Source | Where seen | Migration rule |
|--------|------------|----------------|
| `Math.random` | AI pairing, open random, some draws | Inject `randomSeed` via context |
| `Date.now` | Deadlines, locks, publish | Inject `now` |
| Timezone | Schedule display/slots | Inject `timezone` |
| Iteration order | Object key / Map / Set | Normalize sort before compare/execute |
| DB row order | Cloud lists | Explicit ORDER BY / sort |
| External API | Athlete pool, Elo RPC | Snapshot inputs into context |
| Live rating | Match complete path | Version rating model; pin snapshot |
| Mutable configuration | Flags, club settings | `configSnapshot` hash |

---

## Canonical execution context (locked design)

```js
{
  requestId,
  tenantId,
  competitionId,
  format,
  now,                 // ISO or epoch ms
  timezone,
  randomSeed,
  actor,               // id + resolved roles (server-side)
  runtimeMode,
  capabilityVersions,  // map of version dims
  configSnapshot,      // hash or structured freeze
}
```

Executors receive context explicitly. **No** direct `process.env` / ambient clock / ambient random inside Core executors (architecture test target for 3A+).

---

## Determinism levels by capability

| Capability | Required level |
|------------|----------------|
| Participant, Entry, Roster, Lineup lock | Fully deterministic |
| Seed/Draw (locked modes) | Deterministic given seed |
| Pairing / AI | Seeded policy-equivalent |
| Schedule | Seeded or semantic |
| Standings | Deterministic given results + policy |
