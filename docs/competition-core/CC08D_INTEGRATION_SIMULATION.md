# CC-08D — Integration Simulation

## Temporary branch

`integration/cc08-standings-readiness` @ `3e8b305` (local; not pushed to standardization)

## Simulation steps

1. Base: `fix/standardization-referee-preview-build` @ `88c2a29` (build fix on `cb32ae2`)
2. Merge: `origin/feature/competition-core-cc08-standings` @ `a07a1ed`
3. Merge commit: `3e8b305` — `chore(integration): simulate build-fix + CC-08 standings readiness`

## Conflicts

**None.** Ort merge completed cleanly.

## Resulting history

```
3e8b305 chore(integration): simulate build-fix + CC-08 standings readiness  (merge)
├── 88c2a29 fix(v5): gate incomplete referee preview route
├── a07a1ed fix(competition-core): integrate standings v2 with latest tournament baseline
│   ├── 7ac732a refactor(competition-core): integrate standings v2 runtime adapter
│   └── 7f83311 feat(competition-core): add canonical standings and tie-break engine
└── cb32ae2 fix(rating-v5): unblock V5-B.2 preview menu...  (standardization HEAD)
```

## Logical separation preserved

| Layer | Commits | Independent? |
|-------|---------|--------------|
| Build fix | `88c2a29` | Yes — router-only, v5 scope |
| CC-08 engine | `7f83311` | Yes — competition-core standings |
| CC-08 adapter | `7ac732a` | Yes — runtime shadow wiring |
| CC-08C integration | `a07a1ed` | Yes — tests + docs |

Build fix and CC-08 remain **separate commits** suitable for sequential merge to standardization.

## Files changed (merge)

45 files, +4217 lines — all CC-08/CC-08C artifacts (standings engine, adapters, tests, docs). No overlap with build-fix `router.jsx` change.
