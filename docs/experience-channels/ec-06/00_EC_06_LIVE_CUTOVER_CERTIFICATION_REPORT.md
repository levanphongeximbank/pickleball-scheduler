# EC-06 — Public Portal LIVE Cutover Certification Report

## Safety baseline

- Worktree: `PICK_VN-Workstreams/experience-channels/experience-channels-06-public-portal-live-cutover`
- Branch: `feature/experience-channels-06-public-portal-live-cutover`
- Base: fresh `origin/main` (`97cb1c37` at worktree creation)
- Closed baseline: EC-00 → EC-05, TEST-HYGIENE-01, NEWS-04
- Evidence hashes (pre-implementation):
  - `docs/coaching-training/coaching-03/evidence/APPLY_REFUSED.json` → `A30C5CC05F8A183A68608D62F99A50A05114DB7492078CF166D9DC8072BA3664`
  - `docs/player-management/pm-id-01/activation/evidence/APPLY_REFUSED_NO_GO.json` → `F795FD56A5E2367432B2F779DD17131D673791B98ECA78F3B9044F1CBCA34027`

## Certification gates (all required for CERTIFIED_LIVE_CUTOVER)

1. Remote public source exists  
2. No private auth/tenant requirement  
3. Stable payload mapped via canonical adapter  
4. Request error ≠ empty success  
5. No mock fallback on live failure  
6. Loading/error/empty/unavailable distinct  
7. No sensitive payload  
8. No business logic in UI  
9. Targeted tests  
10. Clear ownership  
11. productionReady evidence  
12. No Competition Engine / ranking calc / backend contract change  

## Surface certification matrix

| ID | Classification | Mock fallback | Implement cutover | Blocking gates |
|----|----------------|---------------|-------------------|----------------|
| `public-clubs` | NO_REMOTE_SOURCE | retained | no | 1, 5, 11 |
| `public-courts` | NO_REMOTE_SOURCE | retained | no | 1, 5, 11 |
| `public-tournaments` | NO_REMOTE_SOURCE | retained | no | 1, 5, 11 |
| `public-rankings` | LIVE_SOURCE_NOT_CERTIFIED | retained | no | 1, 5, 11 |
| `public-home` | LIVE_SOURCE_NOT_CERTIFIED | retained (composite) | no | 1, 5, 11 |
| `home-stats` | NO_REMOTE_SOURCE | retained | no | 1, 11 |
| `home-featured-*` | NO_REMOTE_SOURCE | retained | no | 1, 5 |
| `home-live-scores` / schedule / results / upcoming / sponsors | MOCK_WITH_HONEST_PROVENANCE | n/a (pure mock) | no | 1, 11 |
| `home-news` | ALREADY_LIVE_NO_CHANGE | none (NEWS-04) | no | 11 |
| `public-news` | ALREADY_LIVE_NO_CHANGE | none (NEWS-04) | no | 11 |
| `public-root` | HIGH_COLLISION_DEFERRED | — | no | shell/auth |
| `tournament-public-view` | HIGH_COLLISION_DEFERRED | — | no | Competition boundary |
| `athletes-directory` | HIGH_COLLISION_DEFERRED | — | no | auth/player channel |

**Certified LIVE cutovers: 0**

## Exact safe file scope

- `src/features/experience-channels/public-portal/constants/liveCutoverClassifications.js` (new)
- `src/features/experience-channels/public-portal/certification/**` (new)
- `src/features/experience-channels/public-portal/validation/certifyPublicPortalLiveCutover.js` (new)
- `src/features/experience-channels/public-portal/constants/index.js`
- `src/features/experience-channels/public-portal/validation/index.js`
- `src/features/experience-channels/public-portal/index.js`
- `src/features/experience-channels/index.js`
- `src/features/experience-channels/public-portal/registry/publicPortalSurfaceRegistry.js` (notes only)
- `src/features/experience-channels/ARCHITECTURE.md`
- `docs/experience-channels/ec-06/**`
- `tests/experience-channels-ec-06-public-portal-live-cutover.test.js`
- `scripts/ci/unit-test-files.json`

## Live cutovers implemented

None. Runtime adapters keep EC-03/04/05 honesty behavior:

- Clubs/Courts/Tournaments/Rankings: `allowMockFallback: true`
- Home mock hubs: explicit MOCK provenance
- News: already remote LIVE without silent mock fallback (NEWS-04) — no EC-06 code change

## Deferred / uncertified

- Clubs, Courts, Tournaments — need remote public catalog APIs before cutover
- Rankings — need certified remote public leaderboard (not local VPR store) without engine edits
- Home composite / mock hubs — wait for certified remote section sources
- News productionReady claim — belongs to News production certification, not EC-06 forced cutover
- Competition tournament public detail / athletes directory — high-collision deferred

## Architecture decision

Lock the audit in code so future slices cannot claim LIVE cutover without matrix certification. Reuse EC-02 states, EC-03 PublicDataResult, EC-03/04/05 adapters and `PublicDataSourceNotice`. Do not create APIs, contracts, or notice components.

## Rollback

Revert the EC-06 commit / close the PR branch. Runtime portal behavior is unchanged from EC-05 + NEWS-04.
