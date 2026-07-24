# E2E-02 — Blocker Resolution

## BG-05 — Individual Tournament Template

| Field | Content |
|-------|---------|
| Before | No IND Pool+KO CM template / formatBlueprint |
| Evidence | `createIndividualPoolKnockoutTemplateDefinition()` + CM-02 validation + `registerCompetitionTemplate` |
| After | **CLOSED** for E2E-02 composition boundary |
| Tests | template creation/version/immutability/invalid type/mode/refs + instantiation |
| Owner | E2E-02 |
| Carry-forward | Optional promotion into CM `staticCatalog` seeds can be Owner decision later (not required for runtime path) |

## BG-06 — Pool → Knockout composition

| Field | Content |
|-------|---------|
| Before | CORE-09 GROUP_RR + SE dormant; no composition chain |
| Evidence | `composeIndividualPoolKnockout` wires CORE-08 grouping → CORE-09 GROUP_RR → qualification → CORE-09 SE |
| After | **CLOSED** |
| Tests | pool deterministic RR; qualification top-N / fail-closed ties; knockout byes/SE; full fingerprint |
| Owner | E2E-02 |
| Carry-forward | Portal/ops execution of composition belongs to E2E-03 |

## BG-07 — CM runtime wiring (template/format portion)

| Field | Content |
|-------|---------|
| Before | All CM `wiredToProductionRuntime: false`; no IND composition facade |
| Evidence | `createPoolKnockoutRuntimeComposition` resolves template, instantiates via CM-02, associates format/workflow, injects E2E-01 ports |
| After | **CLOSED for E2E-02 scope** (runtime-ready composition boundary; still not production UI-wired) |
| Tests | CM resolve/instantiate; ports present; missing tenant fail-closed; no seed mutation |
| Owner | E2E-02 |
| Carry-forward | Full create→publish→archive production path + Organizer Portal remains E2E-03 / later BG-07 remainder |

## New blockers

None requiring stop. Qualification remains a **minimal composition/policy boundary** (not a new Core engine) by design.
