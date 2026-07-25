# PM-ID-01 — Security and Tenant Model

## Principles

1. Fail closed.
2. Least privilege.
3. No `USING (true)` / `WITH CHECK (true)`.
4. No anon execute.
5. `REVOKE EXECUTE FROM PUBLIC` on all helpers/RPCs.
6. SECURITY DEFINER functions use fixed `search_path = pg_catalog, public`.
7. Principal always from `auth.uid()` for resolve/RLS helpers.
8. No dynamic SQL from caller strings.

---

## Table access

`public.player_identity_links`:

- RLS enabled.
- Authenticated clients **must not** SELECT the whole table.
- Self-resolve only via:
  - `player_identity_resolve_mapping(tenant_id, club_id)` → jsonb status contract;
  - `player_identity_is_mapped(tenant_id, club_id)` → boolean (true **only** for MAPPED).
- Boolean helper must not leak reason codes (false for every non-MAPPED status including INVALID).

Direct table policies:

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| `anon` | deny | deny | deny | deny |
| `authenticated` | deny (no broad policy) | deny | deny | deny |
| service_role / maintenance | bypass RLS (platform) | — | — | — |

Admin mutations go through SECURITY DEFINER RPCs only.

---

## Admin management RPCs

| RPC | Purpose |
|-----|---------|
| `player_identity_admin_upsert_link` | Create or re-activate mapping (idempotent; version conflict aware) |
| `player_identity_admin_revoke_link` | Soft-revoke ACTIVE → REVOKED |

Requirements enforced inside RPC:

- `auth.uid()` present;
- Actor has administrative permission (see below);
- Actor tenant/club scope covers target;
- Subject principal ≠ arbitrary self-service for PLAYER/COACH (permission required);
- Club belongs to tenant;
- Active uniqueness respected;
- Provenance + `created_by` / `revoked_by` recorded;
- Expected `version` conflict detection on update/revoke;
- No hard DELETE.

### Permission model (this step)

| Code | Status |
|------|--------|
| `user.manage` | **Existing** Identity admin permission — used as interim gate in RPCs |
| `player.identity_link.manage` | **PROPOSED ONLY** — documented; **not seeded**; **not granted** in PM-ID-01 |

RPC authorization check (authored):

```text
is_super_admin()
  OR user_has_permission('user.manage')
```

Plus explicit tenant/club administrative scope checks against trusted inputs.

This step does **not**:

- INSERT into `permissions` / `role_permissions`;
- GRANT Coaching permissions;
- Allow PLAYER or COACH to self-link without admin permission.

---

## Tenant / club binding

On every resolve and write:

1. `tenant_id` and `club_id` required non-empty text.
2. `EXISTS (SELECT 1 FROM clubs c WHERE c.id = club_id AND c.tenant_id = tenant_id)`.
3. Mapping row tenant/club must equal trusted inputs (no cross-scope rewrite).
4. Membership for resolve: `club_members` active for `(tenant_id, club_id, user_id = auth.uid())`.

---

## Revoke semantics

- Sets `status = 'REVOKED'`, `revoked_at = now()`, `revoked_by = auth.uid()`, bumps `version`.
- Historical row retained.
- Subsequent `player_identity_is_mapped` → false immediately.
- Subsequent resolve → `INACTIVE` (when only revoked rows remain).

---

## Forbidden patterns (static verification targets)

- `USING (true)` / `WITH CHECK (true)`
- `GRANT … TO PUBLIC` / `TO anon` on PM-ID-01 functions
- Caller-supplied principal on resolve helpers
- Email/name/phone matching
- `LIMIT 1` without prior uniqueness / AMBIGUOUS handling on resolve
