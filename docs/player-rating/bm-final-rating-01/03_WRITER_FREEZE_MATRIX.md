# BM-FINAL-RATING-01 — Writer Freeze Matrix

| Legacy writer | After Phase B |
|---------------|---------------|
| `saveSelfDeclaredRating` | Frozen / facade-only (requires playerId+actor+expectedVersion) |
| `applyVerifiedRatingToRecord` | Frozen sync (`null`); async delegates to facade |
| `setProvisionalRating` | Frozen sync (`null`); async delegates to facade |
| `incrementRatingMatchCount*` | Frozen — typed failure / null |
| `completePickVnOnboarding` | Assessment draft local OK; rating write fail-closed / facade |
| `verifyClubPlayerRating` (+ admin/tournament) | Frozen without canonical args; async → facade |
| `applySystemVerifiedRating` | Frozen; async → facade |
| `applyRatingProposalToPlayer` | Frozen (`WRITER_FROZEN`) |
| `pushClubPlayersPickVnRatings` | Frozen — blob is not independent writer |
| `hydrateClubPlayersPickVnRatings` | Mirror/read-cache only (`canonicalAuthority: false`) |
| Fire-and-forget `rpcPickVnSyncRating(...).catch(() => {})` | Removed from public writer paths |

Ownership CI rules:

- `player-rating-canonical-write-boundary`
- `player-rating-no-silent-rpc-swallow`
