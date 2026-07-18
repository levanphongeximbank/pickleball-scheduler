# Merge Wave Plan — Phase 3P

## Official wave count

```text
7 waves (Wave 0 … Wave 6)
```

---

## Wave 0 — PHASE 3A.3 — Integration Bootstrap (**REQUIRED**)

| Field | Value |
|-------|-------|
| Official name | **PHASE 3A.3 — INTEGRATION BOOTSTRAP** |
| Status | **REQUIRED** before Phase 3B (Owner-locked) |
| Parallel implementation | Chat I only |
| Merge order | Single Integrator PR |
| Integration gate | Empty registries exist; ownership/export/test conventions locked |
| Regression gate | Arch lock + existing unit tests unchanged green |
| Production safety gate | Flags OFF; shadow deny; no wiring |

## Wave 1 — Participant (3B)

| Field | Value |
|-------|-------|
| Parallel candidates | **3B only** |
| Required merge order | 3B → Integrator |
| Integration gate | Participant local index exported; 3b tests in official manifest |
| Regression gate | Participants 2b2–2b4 still pass; arch lock |
| Production safety gate | No Production participant resolve path |

## Wave 2 — Registration + Team (3C + 3D)

| Field | Value |
|-------|-------|
| Parallel candidates | **3C ∥ 3D** |
| Required merge order | Prefer 3B already on main; then 3C and 3D any order; then Integrator |
| Integration gate | Entry/Registration + Team ports exported; no barrel fights |
| Regression gate | IND registration tests + TT roster tests |
| Production safety gate | No registration/team cutover; format KEEP for team |

## Wave 3 — Lineup + Seeding (3E + 3F)

| Field | Value |
|-------|-------|
| Parallel candidates | **3E ∥ 3F** (after 3D for 3E) |
| Required merge order | **3D before 3E**; 3F after entry freeze; Integrator last |
| Integration gate | Lineup revision/lock shadow; seed pipeline runtime ready |
| Regression gate | TT lineup tests; seed foundation tests |
| Production safety gate | No lineup cloud behavior change without Owner |

## Wave 4 — Draw + Match (3G + 3H)

| Field | Value |
|-------|-------|
| Parallel candidates | **3G ∥ 3H(fixtures)** |
| Required merge order | **3G before 3H** for Production-facing parity merge; Integrator |
| Integration gate | Draw adapter parity thresholds; match graph fixtures |
| Regression gate | Draw/formation/matchmaking suites |
| Production safety gate | Legacy still primary; flags OFF |

## Wave 5 — Schedule + Lifecycle + Standings (3I + 3J + 3K)

| Field | Value |
|-------|-------|
| Parallel candidates | **3I ∥ 3J ∥ 3K(fixtures)** |
| Required merge order | Result DTO freeze early; Integrator sequences merges; prefer 3J contract before 3K prod parity |
| Integration gate | Schedule conflicts; lifecycle state machine shadow; standings parity |
| Regression gate | scheduling-cc09, standings-cc08*, lifecycle new tests |
| Production safety gate | **Critical** — no Elo/live RPC enable; kill switch remains |

## Wave 6 — Publication (3L)

| Field | Value |
|-------|-------|
| Parallel candidates | **3L only** (depends on Draw+Schedule) |
| Required merge order | After Wave 4–5 draw/schedule pieces; Integrator |
| Integration gate | Publish/lock parity plan documented |
| Regression gate | Publish-related format tests |
| Production safety gate | Public gates unchanged under rollback |

## Post-3L (not part of parallel runtime waves)

| Wave | Phases | Note |
|------|--------|------|
| Cutover | 3M | Per-capability Owner GO — never all-at-once |
| Retirement | 3N | After canonical SSOT + read-only window |

---

## Wave diagram

```text
Wave 0:  [PHASE 3A.3 — Integration Bootstrap — REQUIRED]
Wave 1:  [3B Participant]
Wave 2:  [3C Registration] ∥ [3D Team]
Wave 3:  [3E Lineup]        ∥ [3F Seeding]   # 3E only after 3D merged
Wave 4:  [3G Draw]          ∥ [3H Match fixtures]
Wave 5:  [3I Schedule] ∥ [3J Lifecycle] ∥ [3K Standings fixtures]
Wave 6:  [3L Publication]
```
