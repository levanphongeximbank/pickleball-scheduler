# Profile Gender Fix — Preview QA Report

**Verdict: PASS**  
**Production deployed: NO**

| Field | Value |
|-------|--------|
| Preview URL | https://pickleball-scheduler-git-fix-profil-f85a48-pickleball-scheduler.vercel.app |
| Deployment ID | `dpl_Gw8kUQCE6jxtSSf9ZxpFycLBaKpA` |
| Alias | also served by `pickleball-scheduler-mrq4upyif-pickleball-scheduler.vercel.app` |
| Fix commit | `3ca133132f7661825e353cdbc64b3ee432d619bf` |
| Branch HEAD (includes docs) | `1421c88563900c3b6e217e469bc8c4e871f867f9` |
| QA account | `player@staging.local` (PLAYER) |
| Staging Supabase | `qyewbxjsiiyufanzcjcq` (confirmed via REST host) |
| Surface | `/player/profile` |

## Commit on Preview

- Vercel Git Preview alias for `fix/profile-gender-persist`.
- Live bundle exposes radio values `male` / `female` / `other` (not `Nam`/`Nữ` as values).
- Network upsert payload always includes `gender` + `birth_year` (fix write path).
- Local branch contains fix commit (`git merge-base --is-ancestor`).

## Cases

| Case | Result | DB after | UI | Mutations |
|------|--------|----------|----|-----------|
| A Nam → reload | PASS | `male` | Nam checked | 1 |
| B Nữ → logout/login | PASS | `female` | Nữ checked | 1 |
| C Khác → other tab | PASS | `other` | Khác checked | 1 |
| D name/phone keep gender | PASS | `other` preserved | Khác checked | 1 |
| E gender-only no null overwrite | PASS | `male`; name/phone/avatar/birth_year kept | — | 1 |

## Network / DB

- Host: `https://qyewbxjsiiyufanzcjcq.supabase.co/rest/v1/profiles`
- Method: POST upsert
- Payload gender canonical: `male` \| `female` \| `other`
- Response returns same canonical gender
- One mutation per Save (no dual-write wipe)
- `pageerror = 0`

## Regression

- display_name save: PASS (Case D)
- phone save: PASS (Case D)
- avatar not nulled: PASS (Case E)
- birth_year preserved: PASS (Case E)
- Unit tests: PASS (`tests/self-profile-gender.test.js`)
- Build: PASS

## Screenshots

`docs/v5/qa-evidence/phase-profile-gender/screenshots/`

- `case-a-nam-after-reload.png`
- `case-b-nu-after-relogin.png`
- `case-c-khac-other-tab.png`
- `case-d-preserve-gender.png`
- `case-e-gender-only.png`
- `debug-player-profile.png`

## Machine report

`docs/v5/qa-evidence/phase-profile-gender/PREVIEW_QA_REPORT.json`

## Follow-up (post-QA hardening, not required for PASS)

Local follow-up: disable Save until `fetchSelfProfile` hydrates (`profileReady`) to prevent early empty-gender submit race. Deploy separately if desired; Preview QA PASS above is on commit `3ca1331` tree already live.
