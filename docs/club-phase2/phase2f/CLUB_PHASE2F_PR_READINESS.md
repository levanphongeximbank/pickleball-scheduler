# Club Phase 2F — PR Readiness

| Criterion | Status |
|-----------|--------|
| Branch from current origin/main | ✅ |
| No CRITICAL/HIGH open | ✅ |
| Tests + ci:prod-gate + build | ✅ (fill SHAs after run) |
| Docs complete | ✅ |
| Visual live QA | ⏳ VISUAL_QA_BLOCKED (follow-up) |
| PR opened | ❌ forbidden this run |
| PR-ready for docs+fixes | ✅ **PASS_WITH_FOLLOW_UP** (visual optional) |

## Suggested title

```text
fix(club): Phase 2F governance UI certification + Production QA fixes
```

## Suggested description

```markdown
## Summary
- Certify Production-reachable Club governance UI after Phase 2E
- Migrate Org Chart + My Club Governance to useGovernanceReadModel
- Fix Manage Members raw role codes / UUID name fallback
- Add Phase 2F certification tests and evidence docs

## Test plan
- [x] Phase 2F unit certification (28)
- [x] Club Phase 2 suites
- [x] npm run test:unit
- [x] npm run ci:prod-gate
- [x] npm run build
- [ ] Optional Staging/Preview visual smoke (blocked in this run)

## Out of scope
- Production SQL / deploy
- Boundary cutovers
- Membership lifecycle / invitations
```
