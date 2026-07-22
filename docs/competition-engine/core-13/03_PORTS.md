# CORE-13 — Ports

All ports are pure contracts with fail-closed and fixed test doubles.
Test doubles are deterministic and may be async-compatible without network I/O.

---

## Snapshot semantics

| Status | Meaning | Typical severity |
|--------|---------|------------------|
| `MISSING` | Required snapshot absent | **FATAL** |
| `INVALID` | Snapshot present but malformed | **FATAL** |
| `EMPTY` | Valid snapshot with zero items | **ok** (not automatically malformed) |
| `POPULATED` | Valid snapshot with items | **ok** |

Special cases:

1. Missing required port/snapshot → FATAL.
2. Valid referee directory with **zero** candidates → EMPTY; not automatically a malformed request; planning may yield match-recoverable unfilled requirements (`NO_REFEREE_CANDIDATES`).
3. Missing **entire** schedule snapshot → FATAL (`MatchScheduleInputPort` fail-closed / MISSING).
4. Individual match missing `startAt`/`endAt` → MATCH_RECOVERABLE at evaluation time (planner Phase 1C+); schedule row may still exist in a POPULATED snapshot.

---

## Port inventory

| Port | Method | Doubles |
|------|--------|---------|
| RefereeDirectoryPort | `resolveRefereeDirectory` | fail-closed / fixed |
| RefereeQualificationPort | `resolveRefereeQualifications` | fail-closed / fixed |
| RefereeAvailabilityPort | `resolveRefereeAvailability` | fail-closed / fixed |
| ExistingAssignmentPort | `resolveExistingAssignments` | fail-closed / fixed |
| RefereeConflictPolicyPort | `resolveConflictPolicy` | fail-closed / fixed |
| MatchScheduleInputPort | `resolveMatchSchedule` | fail-closed / fixed |
| RefereeAuditSinkPort | `appendAuditRecord` | fail-closed / fixed |
| RefereeWorkloadHistoryPort | `resolveWorkloadHistory` | fail-closed / fixed (optional; empty valid) |

Fixed doubles accept mode tokens: `"missing"` | `"invalid"` | `"empty"` | populated arrays/objects.
