# Phase 1I-0 — RLS & Security Review

**Owner authorization:** `AUTHORIZE_PHASE_1I_0_SQL_READ_MODEL_DESIGN` · **`APPROVE_PHASE_1I_0_READ_MODEL_DESIGN_WITH_CHANGES`**  
**Branch:** `feature/player-phase-1i-0-read-model-design`  
**Base `origin/main` SHA:** `bfb8980852d3c17174b3f77f17331605a5923457`  
**Classification:** Design review only — **NOT AUTHORIZED FOR APPLY**  
**Document verdict:** `READY_FOR_PHASE_1I_0_COMMIT`

---

## 1. Current policies (peer directory blocked)

From `docs/supabase-rbac.sql`:

| Policy | Effect |
|--------|--------|
| `profiles_self_select` | Self or super_admin |
| `profiles_venue_staff_select` | Same-venue staff |
| anon SELECT | **None** |

Ordinary authenticated clients cannot list platform peers. Broad peer SELECT policies remain **rejected**.

---

## 2. DEFINER RPC + hardened search_path

| Control | Design |
|---------|--------|
| Mechanism | `SECURITY DEFINER` RPCs |
| `search_path` | **`pg_catalog, public`** |
| Qualification | Prefer `public.profiles` |
| Auth | `auth.uid() IS NOT NULL` |
| Grants | EXECUTE → `authenticated` only; revoke `anon`/`PUBLIC` |
| Table policies | **Unchanged** |

DEFINER bypasses RLS → compensated by eligibility, **server-side masking**, and **strict output columns**.

---

## 3. Strict output = primary privacy boundary

RPC must **not** return:

`privacy_settings`, `identity_verification_status`, raw `status`, auth uuid, `venue_id`, `club_id`, tenant metadata.

RPC **must** mask:

- `activity_region` / `gender` / `handedness` per show* flags  
- `is_verified` as boolean only  

App may re-validate; **must not** be first privacy boundary; **must never** receive raw `privacy_settings` from this RPC.

---

## 4. Suspended exclusion

Confirmed CHECK on `public.profiles.status`: `'active' | 'suspended' | 'invited'`.  
Eligibility includes `status IS DISTINCT FROM 'suspended'` (`EXCLUDE_SUSPENDED_ONLY`).

---

## 5. Tenant leakage

No venue/club fields in RPC output. No venue filter API. Region filter only when `showActivityRegion` (masked region non-null).

---

## 6. Enumeration

| Control | Design |
|---------|--------|
| Detail miss | Generic not-found |
| Invalid cursor | `INVALID_CURSOR` (no first-page reset) |
| Total COUNT | Not exposed |
| Route id | `player_id` only |

---

## 7. Do not copy `platform_resolve_*` return shape

Those RPCs return wide profile JSON. Directory RPCs are **narrow Directory-safe only**.

---

## 8. Sequencing / Production

1I-B SQL only after 1I-A. No Production apply under 1I-0.

---

## 9. Checklist for 1I-B authoring

- [ ] `SET search_path = pg_catalog, public`  
- [ ] Schema-qualify `public.profiles`  
- [ ] Strict columns only (no privacy_settings / raw verification)  
- [ ] Server-side masking  
- [ ] `status IS DISTINCT FROM 'suspended'`  
- [ ] Invalid cursor → `INVALID_CURSOR`  
- [ ] REVOKE anon/PUBLIC; GRANT authenticated  
- [ ] No profiles SELECT policy expansion  
