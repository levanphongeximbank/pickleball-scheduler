# 03 — Write and Read Path Audit

## Writers (profiles / demographics)

| Source | Path | Fields | Auth model | Bypasses Player Mgmt? |
|--------|------|--------|------------|------------------------|
| Self profile | `selfProfileService` → `updateProfileRowById` | display_name, phone, avatar, gender, **birth_year** | self RLS + guard | **Yes** (Identity path) |
| Athlete self UI | `AthleteSelfProfilePage` | gender, birthYear | self | Yes via Identity |
| Pick_VN onboarding | `pickVnRatingService` → `updateSelfDemographics` | gender, birthYear | self | Yes (side write) |
| My Profile | `MyProfilePage` | name/phone/avatar | self | Yes |
| Admin RPC | `identity_admin_update_user` | name/phone/avatar/role/status/club | admin permissions | Yes — **no** birth_year |
| Staff upsert | `userManagementService` / `staffService` | staff profile map | admin | Typically no demographics |
| Signup trigger | `handle_new_user` | id/email/display/role/status | trigger | N/A |
| Phase 1C facade | `updatePlayerProfile` | owned patch | resolve + injected repo | **Intended single Player write**; default unconfigured |

**Risk:** Dual-write if UI continues calling Identity demographics while Player write is also enabled — must cut over writers after migration (see wiring plan).

## Blob / athlete writers

| Source | Store | Risk |
|--------|-------|------|
| Club blob `players[]` | `club_data_v3` | Legacy operational demographics — not new SSOT |
| Athletes RPCs | `athletes` | No Phase 1C columns |

## Readers

| Consumer | Data |
|----------|------|
| `profileService` / AuthContext | birthYear, gender, account |
| `profileAdapter` / `getPlayerProfile` | normalized Player profile |
| `identity_list_users` (Phase 37) | gender, birth_year |
| `platform_resolve_athlete_profile` | full profile jsonb |
| Pairing / TT gender RPCs | `profiles.gender` preferred |
| Club UI / tournament engines | often **blob** gender/age |

## Compatibility requirement

After migration, Phase 1B/1C read facade must prefer durable `profiles` columns for auth-linked players; blob remains fallback for operational roster until later cutover — not a second write SSOT for foundation fields.
