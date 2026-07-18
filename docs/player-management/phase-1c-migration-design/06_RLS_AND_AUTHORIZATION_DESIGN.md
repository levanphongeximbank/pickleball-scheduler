# 06 — RLS and Authorization Design

## Preserve existing

- `profiles_self_select` / `profiles_self_update`  
- Venue staff select / venue owner update  
- `profiles_guard_privileged_update` for role/venue/club/status  

## Player field authorization (target)

| Actor | Allowed Player fields | Denied |
|-------|----------------------|--------|
| Self (`auth.uid() = id`) | birth_date, birth_year, handedness, activity_region, privacy_settings, gender, phone, display_name, avatar; **not** identity_verification_status (unless product allows self-submit → pending only) | role, status, venue_id, club_id, account suspension |
| Admin with `user.manage` / designated player.admin | May set verification status + demographics within tenant/venue scope | Must not bypass tenant isolation |
| Service role | System backfill / migration | Audited only |
| Anon | **No** raw profiles row; public projector only (Phase 1E) | phone, email, birth_date, full privacy object |

## Sensitive field read rules

| Field | Public | Authenticated peer | Self / staff |
|-------|--------|--------------------|--------------|
| phone / email | Never unless privacy + publicProfile | Internal only | Yes |
| birth_date | Never by default | Restricted | Yes |
| birth_year | Privacy gated | Internal ok | Yes |
| activity_region | Privacy gated | Internal ok | Yes |
| privacy_settings | Never public raw | Self/staff | Yes |
| identity_verification_status | Internal | Staff | Yes |

## Implementation notes (future SQL task)

1. Keep row-level RLS; enforce column sensitivity in **Player public projector** + admin RPCs (do not rely on RLS column grants alone in Postgres without views).  
2. Prefer `profiles` safe view or RPC for public/directory reads.  
3. Extend Identity guard trigger OR Player write RPC so non-self cannot set privileged Player verification without permission.  
4. Tenant isolation: venue staff policies already scope by `venue_id`; club ops must not read cross-tenant profiles.
