# Phase 1I-B — Static Verification Checklist

Run **without** a database connection. Authoring-wave checks only.

## Automated checks (shell / node)

1. Forward SQL contains both RPC names and `p_region text`
2. Forward SQL contains `SET search_path = pg_catalog, public`
3. Forward SQL contains `SECURITY DEFINER` and `auth.uid()`
4. Forward SQL revokes anon / PUBLIC on search+get; grants authenticated
5. Forward SQL does not `GRANT SELECT` on `public.profiles`
6. Projector emit keys exclude forbidden fields
7. Cursor helpers reference `pd1.`
8. Rollback drops both RPCs + indexes
9. Phase 1I-A unit tests pass
10. Secret scan on changed files clean

## Forbidden patterns in forward SQL emit path

Must not appear as **returned JSON object keys** from `player_directory_project_row`:

- privacy_settings
- identity_verification_status
- status (account)
- email / phone / birth_*
- venue_id / club_id / role / rating
- auth user uuid as `id`

## Apply confirmation

- SQL apply: **NO**
- Supabase mutation: **NO**
- Production / deploy: **NO**
