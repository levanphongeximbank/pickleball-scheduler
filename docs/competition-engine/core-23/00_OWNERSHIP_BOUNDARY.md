# CORE-23 — Ownership Boundary

**Capability:** Competition Recovery & Resume  
**Module:** `src/features/competition-core/recovery-resume/`

## Owns

| Concern | Notes |
|---------|--------|
| Recovery checkpoint | Integrity-fingerprinted, fail-closed |
| Resume token / resume context | Single-use by default; optional idempotent re-evaluation |
| Recovery eligibility / preconditions | Deterministic pure evaluation |
| Recovery / resume plans + steps | Planning only — no effect execution |
| Partial-operation assessment | NOT_STARTED / VALIDATED_NO_EFFECTS / PARTIAL / COMPLETED / UNKNOWN / AMBIGUOUS |
| Idempotency + duplicate-prevention references | Required for RETRY/RESUME |
| Last-known-safe state | Evidence-driven; not UI/in-memory |
| Modes | RETRY, RESUME, REPLAY, ROLLBACK, MANUAL_RECOVERY |
| Typed errors + explanations | Capability-local `RECOVERY_*` codes |
| Dependency adapters | Consume public exports by reference only |

## Does not own

| Concern | Owner |
|---------|--------|
| Match lifecycle rules | CORE-15 |
| Workflow definition / transition / resumeWorkflow | CORE-19 |
| Audit persistence | CORE-20 |
| Seed generation / replay algorithms | CORE-21 |
| Import/export packages | CORE-22 |
| Compensation mutation implementation | Owning module (when exposed) |
| UI / SQL / Supabase / deploy / production wiring | Out of scope |

## Mode distinctions

| Mode | Meaning |
|------|---------|
| RETRY | Re-execute after incomplete attempt when idempotent/duplicate-protected |
| RESUME | Continue from checkpoint; never silently repeat completed effects |
| REPLAY | Deterministic verification from CORE-20/21 evidence — not rollback |
| ROLLBACK | Requires explicit compensation capability; otherwise unsupported |
| MANUAL_RECOVERY | Structured operator escalation — not a generic unknown error |
