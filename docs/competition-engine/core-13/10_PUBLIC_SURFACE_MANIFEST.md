# CORE-13 — Public Surface Manifest (Phase 1F Freeze)

**Module:** `src/features/competition-core/referee-assignment/index.js`
**Schema:** `CORE13_REFEREE_ASSIGNMENT_SCHEMA_V1`
**Digest:** `CORE13_DIGEST_SHA256_V1`
**Freeze:** Phase 1F — capability-local only. Root `competition-core/index.js` remains untouched.

## Rules

- No duplicate export names
- No public aliases (`autoAssignReferees`, `dispatchReferees`, `planRefereeAssignments`, `reassignReferee`)
- No internal ranking / planner-state helpers exported
- No raw SHA-256 round functions exported
- No FNV helpers exported
- `assignReferees` ×1, `replaceRefereeAssignment` ×1

---

## Schema / identity constants

| Export | Class |
|--------|-------|
| `CORE13_ENGINE_ID` | schema constant |
| `CORE13_ENGINE_VERSION` | schema constant |
| `CORE13_SCHEMA_VERSION` | schema constant |
| `CORE13_DETERMINISM_POLICY_ID` | schema constant |
| `CORE13_COMPARATOR_VERSION` | schema constant |
| `CORE13_CANONICAL_SERIALIZATION_VERSION` | schema constant |
| `CORE13_IDENTITY` | schema constant |
| `CORE13_DIGEST_VERSION` | schema constant |
| `CORE13_FINGERPRINT_VERSION` | schema constant (alias of digest version) |
| `CORE13_DIGEST_DOMAIN` | schema constant |
| `CORE13_ID_PREFIX` | schema constant |
| `CORE13_ID_DIGEST_HEX_LEN` | schema constant |

## Enums

| Export | Class |
|--------|-------|
| `REFEREE_ROLE_CODE` | enum |
| `REFEREE_ROLE_CODE_VALUES` | enum |
| `isRefereeRoleCode` | enum |
| `normalizeRefereeRoleCode` | enum |
| `REFEREE_ASSIGNMENT_STATUS` | enum |
| `REFEREE_ASSIGNMENT_STATUS_VALUES` | enum |
| `isRefereeAssignmentStatus` | enum |
| `REFEREE_ASSIGNMENT_SOURCE` | enum |
| `REFEREE_ASSIGNMENT_SOURCE_VALUES` | enum |
| `isRefereeAssignmentSource` | enum |
| `REFEREE_CONFLICT_TYPE` | enum |
| `REFEREE_CONFLICT_TYPE_VALUES` | enum |
| `isRefereeConflictType` | enum |
| `REFEREE_CONSTRAINT_KIND` | enum |
| `REFEREE_CONSTRAINT_KIND_VALUES` | enum |
| `isRefereeConstraintKind` | enum |
| `REFEREE_DIAGNOSTIC_SEVERITY` | enum |
| `REFEREE_DIAGNOSTIC_SEVERITY_VALUES` | enum |
| `isRefereeDiagnosticSeverity` | enum |
| `REFEREE_AVAILABILITY_SOURCE` | enum |
| `REFEREE_AVAILABILITY_SOURCE_VALUES` | enum |
| `isRefereeAvailabilitySource` | enum |
| `REFEREE_AUDIT_ACTION` | enum |
| `REFEREE_AUDIT_ACTION_VALUES` | enum |
| `isRefereeAuditAction` | enum |
| `REFEREE_SNAPSHOT_STATUS` | enum |
| `REFEREE_SNAPSHOT_STATUS_VALUES` | enum |
| `isRefereeSnapshotStatus` | enum |
| `REFEREE_RESOURCE_TYPE` | enum |
| `REFEREE_SOFT_NOTE_CODE` | enum |
| `REFEREE_SOFT_NOTE_CODE_VALUES` | enum |
| `isRefereeSoftNoteCode` | enum |
| `REFEREE_SOFT_OBJECTIVE_KEY` | enum |
| `REFEREE_SOFT_OBJECTIVE_KEY_VALUES` | enum |
| `isRefereeSoftObjectiveKey` | enum |

## Diagnostic codes / errors

| Export | Class |
|--------|-------|
| `REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE` | diagnostic code |
| `REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE_VALUES` | diagnostic code |
| `isRefereeAssignmentDiagnosticCode` | diagnostic code |
| `REFEREE_DIAGNOSTIC_DEFAULT_SEVERITY` | diagnostic code |
| `resolveDefaultDiagnosticSeverity` | diagnostic code |
| `RefereeAssignmentContractError` | diagnostic code |
| `isRefereeAssignmentContractError` | diagnostic code |

## Contract factories

| Export | Class |
|--------|-------|
| `createRefereeCandidate` | contract factory |
| `REFEREE_CANDIDATE_FORBIDDEN_PROFILE_FIELDS` | contract factory |
| `createRefereeQualification` | contract factory |
| `createRefereeAvailabilityWindow` | contract factory |
| `createRefereeRoleRequirement` | contract factory |
| `createRefereeAssignmentPolicy` | contract factory |
| `createSnapshotRef` | contract factory |
| `createScheduleWindow` | contract factory |
| `createRefereeAssignmentContext` | contract factory |
| `createRefereeAssignmentRequest` | contract factory |
| `createRefereeConflict` | contract factory |
| `createRefereeWorkload` | contract factory |
| `createRefereeAssignment` | contract factory |
| `createUnassignedRefereeRequirement` | contract factory |
| `createRefereeAssignmentFailure` | contract factory |
| `createManualAssignmentRejection` | contract factory |
| `createRefereeAssignmentPlan` | contract factory |
| `createManualRefereeAssignmentRequest` | contract factory |
| `createRefereeReplacementRequest` | contract factory |
| `createRefereeReplacementResult` | contract factory |
| `createRefereeAssignmentAuditRecord` | contract factory |
| `createRefereeResourceConflictProjection` | contract factory |
| `createHardFailure` | contract factory |
| `createSoftNote` | contract factory |
| `createRefereeEligibilityResult` | contract factory |
| `sortHardFailures` | contract factory |
| `collectReasonCodes` | contract factory |

## Port factories / helpers

| Export | Class |
|--------|-------|
| `createPortResolveResult` | port factory |
| `createMissingSnapshotResult` | port factory |
| `createInvalidSnapshotResult` | port factory |
| `createEmptySnapshotResult` | port factory |
| `createPopulatedSnapshotResult` | port factory |
| `REFEREE_DIRECTORY_PORT_METHODS` | port factory |
| `matchesRefereeDirectoryPort` | port factory |
| `createFailClosedRefereeDirectoryPort` | port factory |
| `createFixedRefereeDirectoryPort` | port factory |
| `REFEREE_QUALIFICATION_PORT_METHODS` | port factory |
| `matchesRefereeQualificationPort` | port factory |
| `createFailClosedRefereeQualificationPort` | port factory |
| `createFixedRefereeQualificationPort` | port factory |
| `REFEREE_AVAILABILITY_PORT_METHODS` | port factory |
| `matchesRefereeAvailabilityPort` | port factory |
| `createFailClosedRefereeAvailabilityPort` | port factory |
| `createFixedRefereeAvailabilityPort` | port factory |
| `EXISTING_ASSIGNMENT_PORT_METHODS` | port factory |
| `matchesExistingAssignmentPort` | port factory |
| `createFailClosedExistingAssignmentPort` | port factory |
| `createFixedExistingAssignmentPort` | port factory |
| `REFEREE_CONFLICT_POLICY_PORT_METHODS` | port factory |
| `matchesRefereeConflictPolicyPort` | port factory |
| `createFailClosedRefereeConflictPolicyPort` | port factory |
| `createFixedRefereeConflictPolicyPort` | port factory |
| `MATCH_SCHEDULE_INPUT_PORT_METHODS` | port factory |
| `matchesMatchScheduleInputPort` | port factory |
| `createMatchScheduleRow` | port factory |
| `createFailClosedMatchScheduleInputPort` | port factory |
| `createFixedMatchScheduleInputPort` | port factory |
| `REFEREE_AUDIT_SINK_PORT_METHODS` | port factory |
| `matchesRefereeAuditSinkPort` | port factory |
| `createFailClosedRefereeAuditSinkPort` | port factory |
| `createFixedRefereeAuditSinkPort` | port factory |
| `REFEREE_WORKLOAD_HISTORY_PORT_METHODS` | port factory |
| `matchesRefereeWorkloadHistoryPort` | port factory |
| `createFailClosedRefereeWorkloadHistoryPort` | port factory |
| `createFixedRefereeWorkloadHistoryPort` | port factory |

## Deterministic public helpers

| Export | Class |
|--------|-------|
| `compareStableString` | deterministic public helper |
| `compareStableId` | deterministic public helper |
| `sortStableIds` | deterministic public helper |
| `sortedObjectKeys` | deterministic public helper |
| `isPlainObject` | deterministic public helper |
| `deepFreezeCanonical` | deterministic public helper |
| `freezePlainObject` | deterministic public helper |
| `assertCanonicalPlainValue` | deterministic public helper |
| `normalizeStableId` | deterministic public helper |
| `normalizeOptionalStableId` | deterministic public helper |
| `normalizeStableIdArray` | deterministic public helper |
| `normalizePreferenceTags` | deterministic public helper |
| `prepareFingerprintMaterial` | deterministic public helper |
| `prepareCanonicalObjectProjection` | deterministic public helper |
| `sha256HexUtf8` | deterministic public helper |
| `canonicalizeJsonValue` | deterministic public helper |
| `serializeCanonical` | deterministic public helper |
| `digestCanonical` | deterministic public helper |
| `fingerprintValue` | deterministic public helper |
| `buildNamespacedId` | deterministic public helper |
| `buildAssignmentId` | deterministic public helper |
| `buildPlanId` | deterministic public helper |
| `buildReplacementId` | deterministic public helper |
| `seedExplorationKey` | deterministic public helper |
| `normalizePlannerSeed` | deterministic public helper |

## Service operations

| Export | Class |
|--------|-------|
| `evaluateRefereeEligibility` | service operation |
| `detectRefereeConflicts` | service operation |
| `calculateRefereeWorkload` | service operation |
| `validateManualRefereeAssignment` | service operation |
| `explainUnassignedMatch` | service operation |
| `parseInstantMs` | service operation |
| `requireHalfOpenWindow` | service operation |
| `tryHalfOpenWindow` | service operation |
| `intervalsOverlapHalfOpen` | service operation |
| `windowFullyCovers` | service operation |
| `durationMinutes` | service operation |
| `normalizeConflictPolicy` | service operation |
| `isActiveAssignmentStatus` | service operation |
| `buildReasonCounts` | service operation |
| `stableUniqueReasonCodes` | service operation |

## Planner / replacement operations

| Export | Class |
|--------|-------|
| `assignReferees` | planner operation |
| `replaceRefereeAssignment` | replacement operation |

---

## Frozen identity prefixes

- `core13_assignment_v1_`
- `core13_plan_v1_`
- `core13_replacement_v1_`
- `core13_audit_v1_`

## Frozen digest domains

See `CORE13_DIGEST_DOMAIN` — assignment, plan, plan fingerprint, replacement, replacement result, audit, and all snapshot domains.

## Explicitly not exported

- `sha256DigestBytes` / SHA round internals
- `hashStringToUint32` / FNV helpers
- `buildSoftScoreVector` / `compareCandidates` (planning internals)
- `buildWorkloadCohort` / planner private helpers
- `autoAssignReferees`, `dispatchReferees`, `planRefereeAssignments`, `reassignReferee`
