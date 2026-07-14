# Profile Gender — Production Deploy + Smoke

**Verdict: PASS**

| Field | Value |
|-------|--------|
| Production URL | https://pickleball-scheduler-eight.vercel.app |
| Deployment ID | `dpl_A6fjxaa4SkTALu7xarFtGPX9GNim` |
| Source fix commit (requested) | `3ca133132f7661825e353cdbc64b3ee432d619bf` |
| Cherry-pick on main | `430b90d` (same content as 3ca1331) |
| Production raise-patch HEAD | `04a648389821bde789ec7377c3055f55dac94c87` |
| QA account | `player@gmail.com` |
| Supabase | Production `expuvcohlcjzvrrauvud` |
| Schema / RPC / RLS / migration | **None** (app-only) |

## What shipped

1. Canonical gender UI/write path (`male`/`female`/`other`) — from Preview QA PASS commit `3ca1331`.
2. Production smoke found upsert blocked by RLS INSERT (`new row violates row-level security policy`).
3. Raise-patch `04a6483`: self-profile uses **UPDATE** of editable fields only (no INSERT path). Still **no** schema/RPC/RLS migration.

## Smoke cases

| Case | Result | DB |
|------|--------|-----|
| A Nam + reload | PASS | `male` |
| B Nữ + logout/login | PASS | `female` |
| C Khác + new tab | PASS | `other` |
| D name/phone keep gender | PASS | `other` preserved |
| E gender-only no null overwrite | PASS | `male`; name/phone/avatar/birth_year kept |
| NETWORK | PASS | 1 mutation/save; Production host only |
| PAGEERROR | PASS | 0 |

## Evidence

- `docs/v5/qa-evidence/phase-profile-gender/PRODUCTION_SMOKE_REPORT.json`
- `docs/v5/qa-evidence/phase-profile-gender/production-screenshots/`
- Deploy logs: `PRODUCTION_DEPLOY.txt` (first), `PRODUCTION_DEPLOY_UPDATE_FIX.txt` (final)

## Rollback

```bash
# Redeploy previous Production deployment via Vercel rollback UI, or:
git revert 04a6483 430b90d
npx vercel --prod --yes
```

No DB rollback required (no migration).
