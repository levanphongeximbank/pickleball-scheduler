# CORE-13 — Public Contracts

**Schema version:** `CORE13_REFEREE_ASSIGNMENT_SCHEMA_V1`
**Module:** `src/features/competition-core/referee-assignment/contracts/`

Phase 1B defines immutable contract factories and strict allowlisted validators.
Unknown fields fail closed. Deterministic/replay fields reject functions, `Date`, `Map`, `Set`, `Symbol`, `BigInt`, `NaN`, and `Infinity`.
Factories do not generate wall-clock values or random IDs.

---

## Identity field separation

| Field | Meaning |
|-------|---------|
| `refereeId` | Competition referee identity (directory key) |
| `playerId` | Optional linked player for COI checks |
| `userId` | Optional auth user link (not required by engine) |
| `tenantId` / `tournamentId` | Required scope |
| `organizationId` / `clubIds` | Affiliation for COI / soft familiarity |
| `matchId` | Match scope |
| `roleCode` | Staffing role |
| qualification / certification | Evidence via `RefereeQualification` / refs |
| availability | `RefereeAvailabilityWindow` |
| assignment status | `RefereeAssignment.status` |

---

## Contract inventory

| Factory | Notes |
|---------|-------|
| `createRefereeCandidate` | Projection only; no profile aggregate |
| `createRefereeQualification` | Evidence reference |
| `createRefereeAvailabilityWindow` | Requires `startAt`/`endAt` strings |
| `createRefereeRoleRequirement` | min/max counts; mandatory flag |
| `createRefereeAssignmentPolicy` | Hard/soft knobs; soft override flag |
| `createRefereeAssignmentContext` | Bound snapshots + optional schedule window |
| `createRefereeAssignmentRequest` | Requires tenant, tournament, non-empty matchIds |
| `createRefereeConflict` | Referee-domain conflict fact |
| `createRefereeWorkload` | Quantized integers |
| `createRefereeAssignment` | One role fill |
| `createRefereeAssignmentPlan` | Plan shape; fingerprint optional until 1D |
| `createUnassignedRefereeRequirement` | Gap diagnostics |
| `createRefereeAssignmentFailure` | Envelope; manual uses `MANUAL_ASSIGNMENT_REJECTED` |
| `createManualAssignmentRejection` | Preserves `causedBy` / `reasonCodes` |
| `createManualRefereeAssignmentRequest` | Hard never overridable |
| `createRefereeReplacementRequest` | `assignmentId` or `(matchId, roleCode)` |
| `createRefereeReplacementResult` | ok + assignments or failure |
| `createRefereeAssignmentAuditRecord` | `recordedAt` caller/sink supplied |
| `createRefereeResourceConflictProjection` | CORE-14 projection; `resourceType=REFEREE` |

---

## Manual rejection rule

Envelope code: `MANUAL_ASSIGNMENT_REJECTED` (FATAL).
Underlying reason preserved in `causedBy` and/or `reasonCodes`.
