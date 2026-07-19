# Club Phase 2E — Version / Refresh Behavior

1. Read model exposes `club_version` from canonical club payload.
2. Mutation success → UI calls `refreshAll` / `reload` / `bumpRevision`.
3. `VERSION_CONFLICT` → `shouldRefetchGovernanceOnConflict` → refetch; clear pre-mutation officers via new snapshot.
4. Cache: membership revision + hook request sequence; stale in-flight responses discarded.
5. No infinite refresh loop — refresh is explicit (mutation result or user retry).
6. Error retry is explicit button / `reload()`.
