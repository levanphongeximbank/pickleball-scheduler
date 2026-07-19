# Integrator Model — Phase 3P

## Identity

```text
CHAT I — INTEGRATOR
```

Standing chat. May be the only chat allowed to modify protected shared files.

## Responsibilities

1. Maintain protected file list integrity
2. Re-export capability symbols into root `competition-core/index.js`
3. Register capability comparators / allowlists / executors into registries
4. Merge phase sub-manifests into `scripts/ci/unit-test-files.json`
5. Add cross-capability integration tests per wave
6. Resolve merge conflicts on shared barrels
7. Update architecture documentation indexes
8. Run and certify: arch lock, unit tests, build, lint:no-new
9. Produce **CHAT I — INTEGRATION REPORT** per wave
10. Enforce Production safety invariants (flags OFF, shadow deny, no cutover)

## Forbidden actions

```text
Do NOT invent new capability business algorithms
Do NOT enable feature flags or Shadow in Production
Do NOT perform runtime cutover
Do NOT apply database migrations
Do NOT retire legacy (3N)
Do NOT expand architecture-lock debt baseline without Owner
Do NOT merge capability PR that edited protected files without rewrite
Do NOT open Chat 2–N without Owner checklist GO
```

## When integration occurs

| Trigger | Action |
|---------|--------|
| End of each merge wave | Integrator PR |
| Capability PR accidentally touches protected file | Reject / strip / re-apply via Integrator |
| Registry needs new capability entry | Integrator only |
| Official manifest update | Integrator only |

## Required inputs from capability chats

Each capability chat must deliver:

| Input | Required |
|-------|----------|
| Branch name + base SHA | YES |
| Changed file list | YES |
| Capability-local index exports list | YES |
| Sub-manifest JSON | YES |
| Comparator module path (if any) | YES |
| “Shared files touched” = none | YES |
| Test evidence | YES |
| Production impact = NONE | YES |
| Blockers | YES |
| Implementation report (see reporting-protocol) | YES |

## Integration tests (minimum per wave)

| Wave | Integration tests |
|------|-------------------|
| 1 | Participant public export smoke + arch lock |
| 2 | Registration uses Participant refs; Team ports shape |
| 3 | Lineup revision vs roster lock; Seed consumes entry ids |
| 4 | Draw consumes seed; Match fixtures from draw groups |
| 5 | Schedule from matches; Standings from result DTO; Lifecycle shadow no write |
| 6 | Publication gates with draw/schedule snapshots |

## Merge sequence (Integrator)

```text
1. Verify capability branches based on correct main
2. Merge capability PR(s) in wave order (respect HARD deps)
3. Open integrator-wave-N branch from updated main
4. Apply exports + registry + manifest + integration tests
5. Run validation suite
6. Owner review
7. Merge Integrator PR
8. Tag wave complete in docs index
```
