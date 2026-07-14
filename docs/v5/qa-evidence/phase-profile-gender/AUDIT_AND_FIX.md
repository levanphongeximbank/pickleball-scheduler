# Profile gender persistence — audit + fix

**Branch:** `fix/profile-gender-persist`  
**Commit:** `3ca133132f7661825e353cdbc64b3ee432d619bf`  
**Production deploy:** ❌ blocked until Preview QA PASS  
**Generated:** 2026-07-14  
**Preview URL:** Vercel auto-deploy on branch push — check Vercel dashboard for `fix/profile-gender-persist` (CLI/`gh` unavailable locally this session).

## Root cause

1. **UI ↔ DB value mismatch (primary user-visible bug)**  
   - `AthleteSelfProfilePage` RadioGroup used values `Nam` / `Nữ` / `Khác`.  
   - Phase 31 + onboarding write **canonical** `male` / `female` / `other` into `public.profiles.gender`.  
   - Staging TT2C evidence already showed `profiles.gender` resolving as `male`.  
   - On reload, form state became `"male"` which matched **no** radio option → UI looked empty (“không giữ giới tính”) even when DB had a value.

2. **Split write path omitted demographics on the first upsert**  
   - Save called `updateSelfProfile({ displayName, phone, avatarUrl })` **without** `gender` / `birth_year`, then `updateSelfDemographics`.  
   - Avatar / phone-only saves similarly omitted demographics.  
   - Fix: every self upsert **always** includes preserved or updated `gender` + `birth_year`, and athlete Save is a **single** `updateSelfProfile` payload.

Cloud `public.profiles` remains canonical. Session is replaced from the returned row after update (`saveAuthSessionFromCloudProfile`). No auth.user_metadata dual-write.

## Schema evidence

### MCP

Supabase MCP `execute_sql` unavailable this session (`Cannot call tool before MCP process client is registered`) after successful `mcp_auth`. Re-run:

- `docs/v5/PHASE_PROFILE_GENDER_SCHEMA_AUDIT.sql` in Dashboard SQL
- or `node scripts/audit-profile-gender-schema.mjs` (needs service role env)

### Documented / prior Staging facts (do **not** ADD COLUMN if present)

| Source | Finding |
|--------|---------|
| `docs/v5/PHASE_31_PICK_VN_ONBOARDING_PROFILE.sql` | `profiles.gender text`, `birth_year integer`; comment `male \| female \| other` |
| `docs/v5/qa-evidence/phase-tt2/TT2C_VALIDATION_REPORT.json` | Staging: `profiles.gender` → `male` for probe player |
| `scripts/prep-tt2c-staging-player-genders.mjs` | Writes Vietnamese labels historically (`Nam`/`Nữ`) into same column — both forms exist in the wild |

**Expected:** column exists, nullable, no hard CHECK in Phase 31 SQL (constraint list must be confirmed via audit SQL). App now normalizes all writes to `male|female|other|null`.

## Code path (before → after)

| Layer | Before | After |
|-------|--------|-------|
| UI | `GENDER_OPTIONS` values `Nam/Nữ/Khác` | `PROFILE_GENDER_OPTIONS` values `male/female/other`, labels Nam/Nữ/Khác |
| Load | raw `profile.gender` | `toProfileGenderFormValue(...)` |
| Save | dual upsert | one `updateSelfProfile({…, gender, birthYear})` |
| Service | demographics not in first upsert | always send preserved/normalized gender + birth_year |
| Session | `saveAuthSession` | `saveAuthSessionFromCloudProfile` from canonical row |
| Auth map | pass-through gender | `normalizeProfileGender` in `mapProfileRowToUser` |

### Payload (sanitized)

**Before (athlete Save):**  
1) `{ display_name, phone, avatar_url, role, venue_id, … }` — **no gender**  
2) `{ …, gender: "Nữ", birth_year }`  

**After:**  
`{ display_name, phone, avatar_url, gender: "female", birth_year, … }` (keys only; QA log via DEV / `VITE_ENABLE_AUTH_DEBUG`)

### Authorization

- Still self-id only (`auth.uid` via RLS `profiles_self_update` + client check `existing.profile.id === user.id`).  
- Trigger still blocks venue/club/status/role self-escalation.  
- No Super Admin bypass required for self-profile.  
- No broadened column grants.

## Tests

```
node --test tests/self-profile-gender.test.js tests/self-profile-variant.test.js tests/identity-phaseB.test.js
→ 27 pass
npm run build → PASS
```

Coverage: normalization, empty string → null, gender in payload, preserve on phone-only update, session reload snapshot, editable field list.

## Preview / browser QA

- Push branch → Vercel Preview (staging Supabase).  
- Flow A–I in ticket; verify DB: `select id, gender, birth_year, display_name, phone from profiles where id = auth.uid();`  
- Regression: display_name, phone, birth_year, avatar still save.

## Rollback

```bash
git revert <commit>
# or redeploy previous Preview / main
```

No Production SQL migration required for this fix (client contract only), unless audit shows column missing on an env (then apply Phase 31 add-column only).
