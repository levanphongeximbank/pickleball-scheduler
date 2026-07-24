# E2E-02 — Template and Format Contract

## Individual Tournament Template

| Field | Value |
|-------|-------|
| `templateId` | `ce-e2e02-individual-pool-knockout` |
| `templateVersion` | `1` |
| Scope | `global` |
| Participant mode | `individual` |
| Supported competition types | `internal_tournament`, `official_tournament` |
| Format blueprint | `individual_pool_knockout` |
| Workflow | `e2e02-pool-qualification-knockout-v1` |

Template is CM-02-compatible (`validateCompetitionTemplateDefinition`) and contains **no runtime service instances**.

Registered into CM catalogs via public `registerCompetitionTemplate` (composition adapter) — CM closed `staticCatalog.js` is **not** rewritten.

## Pool + Knockout Format

| Field | Value |
|-------|-------|
| `formatId` | `individual-pool-knockout` |
| `formatVersion` | `1.0.0` |
| Stage sequence | `POOL` → `QUALIFICATION` → `KNOCKOUT` |
| Pool strategy | CORE-09 `GROUP_ROUND_ROBIN` |
| Knockout strategy | CORE-09 `SINGLE_ELIMINATION` |
| Qualification | `TOP_N_PER_POOL` (default) or `GLOBAL_TOP_N` |
| Unresolved ties | `FAIL_CLOSED` |
| Fingerprint | `configurationFingerprint` (`fmt:…`) |

Participant counts are generalized via pool sizing + power-of-two knockout padding (no hard-coded single N).

## Instantiation output

`instantiateIndividualPoolKnockoutTemplate()` returns frozen:

- template identity/version
- format identity/version + fingerprint
- CM-02 instantiation plan/patch (no CM-01 mutation)
- rule + workflow references
- composition fingerprint
