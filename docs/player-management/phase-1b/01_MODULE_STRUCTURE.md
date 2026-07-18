# 01 — Module Structure

```text
src/features/player/
├── adapters/
│   ├── genderAdapter.js
│   ├── profileAdapter.js      # Identity profiles → partial
│   ├── blobPlayerAdapter.js   # club_data_v3.players[] → partial
│   └── athleteAdapter.js      # athletes → partial (alias)
├── constants/
│   ├── resolutionOutcomes.js
│   └── privacy.js
├── models/
│   ├── playerProfile.js
│   └── resolutionResult.js
├── repositories/
│   └── playerSourceRepository.js   # injectable read wrappers
├── services/
│   ├── resolveByAuthUser.js
│   ├── resolveCanonicalPlayerId.js
│   ├── getPlayerProfile.js
│   └── searchPlayers.js
├── selectors/
│   └── profileSelectors.js
├── utils/
│   ├── playerId.js
│   └── readOnlyGuard.js            # write surface closed
└── index.js                        # stable public API only
```

## Public API (`index.js`)

Stable contracts only:

- `RESOLUTION_OUTCOME`
- `resolveByAuthUser`
- `resolveCanonicalPlayerId`
- `getPlayerProfile`
- `searchPlayers`
- `normalizePlayerProfile`

Adapters, repositories, selectors, player-id helpers, and read-only guards remain **internal** (importable by path for tests/tooling only — not part of the public contract).

## Dependency direction

```text
services → repositories/adapters/models/constants
adapters → models/player gender helper (normalizeAthleteGender)
services → club canonical resolvePlayerForProfile / buildDerivedAuthPlayerId (wrap, not rewrite)
```

No imports from UI pages. Write helpers exist only under `utils/readOnlyGuard.js` (not exported publicly).
