# PHASE 45A.3C — Canonical `public.club_update` RPC — Design & Contract Report

**Status:** authored, NOT deployed, NOT executed. Runtime cutover is Phase 45A.3D.
**Branch:** `integration/phase45a3c-club-update-rpc` (from `origin/main` `cb2af72`)
**Confidence:** EXACT — every convention below is proven from committed schema + the existing deployed command family.

---

## 1. Scope

Author exactly **one** new RPC — `public.club_update(...)` — closing the Club UPDATE gap identified in Phase 45A.3B. Before this file, Club UPDATE had no canonical path: `clubTenantService.updateClub` wrote to the legacy blob (`updateClubMeta`) + legacy registry (`club_upsert_registry` → `public.club_governance`), never to the Club SSOT `public.clubs`.

This phase does **not** touch runtime, UI, `ClubContext`, `clubTenantService`, `domain/clubService`, feature flags, or Production. It only creates the SQL contract + contract tests.

---

## 2. Existing command comparison matrix

Conventions extracted from `club_create` (`PHASE_42G`), and the three reconciled governance RPCs (`PHASE_45A3A`); helpers from `PHASE_42C_RLS_RPC.sql`.

| Convention | club_create | club_assign_owner | club_clear_owner | club_transfer_president | **club_update (new)** |
|---|---|---|---|---|---|
| Language / security | plpgsql / DEFINER | plpgsql / DEFINER | plpgsql / DEFINER | plpgsql / DEFINER | **plpgsql / DEFINER** |
| `search_path` | `public` | `public` | `public` | `public` | **`public`** |
| Returns | `json` | `json` | `json` | `json` | **`json`** |
| Auth (`auth.uid()` null → `NOT_AUTHENTICATED`) | ✅ | ✅ | ✅ | ✅ | **✅** |
| `p_request_id` null → `REQUEST_ID_REQUIRED` | ✅ | ✅ | ✅ | ✅ | **✅** |
| Idempotency get/put (`phase42_idempotency_*`) | ✅ | ✅ | ✅ | ✅ | **✅ (`club_update`)** |
| Row lock (`... for update`) | n/a (insert) | ✅ | ✅ | ✅ | **✅** |
| Optimistic version (`<> coalesce(p_expected_club_version, version)` → `VERSION_CONFLICT`) | n/a | ✅ | ✅ | ✅ | **✅** |
| Version bump (`version = version + 1`) | insert v1 | ✅ | ✅ | ✅ | **✅** |
| Authorization helpers | `can_create_in_tenant` + perm | SA / tenant_member | SA / tenant_member | SA / gov_role / tenant_member | **SA / gov_role(owner,president) / tenant_member** |
| Audit (`phase42_write_audit`) | `club.create` | `club.assign_owner` | `club.clear_owner` | `club.transfer_president` | **`club.update`** |
| Canonical response (`phase42_club_canonical` + `ok`/`version`) | ✅ | ✅ | ✅ | ✅ | **✅** |
| Error via `phase42_err` | ✅ | ✅ | ✅ | ✅ | **✅** |
| Grant | `to authenticated` | `to authenticated` | `to authenticated` | `to authenticated` | **`to authenticated`** |

`club_update` follows `club_transfer_president`'s authorization shape (the most permissive Club-level write: SA **or** club_owner/president **or** tenant owner/staff) and `club_create`'s duplicate-name/code + exception-handler shape.

---

## 3. New RPC design & signature

```
public.club_update(
  p_request_id uuid,
  p_club_id text,
  p_expected_club_version integer,
  p_name text default null,
  p_code text default null,
  p_description text default null,
  p_status text default null,
  p_registered_cluster_id text default null
) returns json
```

Flow: auth → request_id → idempotency replay → load+lock row (`deleted_at is null … for update`) → version check → authorization → resolve fields (NULL = unchanged) → name/status validation → duplicate name/code (exclude self) → `update public.clubs … version = version + 1` → `club.update` audit → canonical response → idempotency put. `unique_violation`/`others` map to `DUPLICATE_CLUB`/`UPDATE_FAILED`.

**Writes only `public.clubs`.** No `club_members`, no `club_governance_assignments`, no legacy `club_governance`, no blob. `updated_at` is maintained automatically by the deployed `trg_clubs_updated` trigger (`set_updated_at()`), matching the governance RPCs (which also never set `updated_at` explicitly).

---

## 4. SQL contract

See `PHASE_45A3C_CLUB_UPDATE_RPC.sql`. Two statements:
1. `audit_logs_action_check` constraint patch adding `'club.update'` (full existing set preserved) — required because `phase42_write_audit` inserts into `audit_logs` and swallows constraint violations, so without whitelisting, `club.update` audit rows would be silently dropped.
2. `create or replace function public.club_update(...)` + `grant execute … to authenticated`.

---

## 5. Authorization

Allowed to update:
- **Platform super admin** — `phase42_is_platform_super_admin()`
- **club_owner / president** — `phase42_has_gov_role(club_id, array['club_owner','president'])`
- **Tenant owner/staff** — `phase42_is_tenant_member(tenant_id)` (derived from the locked row's `tenant_id`, so cross-tenant callers fail here → `FORBIDDEN`)

No second authorization model; identical helper set to the existing Club command family.

---

## 6. Audit

Canonical action **`club.update`**, emitted via `phase42_write_audit('club.update','club', club_id, tenant_id, club_id, {...})`. Metadata records `request_id`, `from_version`, and a boolean `fields` map (which fields were supplied). Whitelisted in `audit_logs_action_check` alongside `club.create`, `club.assign_owner`, `club.clear_owner`, `club.transfer_president` — consistent naming and shape.

---

## 7. Error mapping (server token → registered `API_ERROR_CODES`)

No new API error codes are introduced; server tokens are the same vocabulary the existing RPCs already return, mapped by the client wrapper (added in 45A.3D).

| Server token | Condition | `API_ERROR_CODES` |
|---|---|---|
| `NOT_AUTHENTICATED` | `auth.uid()` null | `UNAUTHORIZED` |
| `REQUEST_ID_REQUIRED` | missing request id | `VALIDATION_ERROR` |
| `NOT_FOUND` | club missing / soft-deleted | `NOT_FOUND` |
| `VERSION_CONFLICT` | stale `p_expected_club_version` | `CONFLICT` |
| `FORBIDDEN` | not SA/owner/president/tenant-member | `FORBIDDEN` |
| `NAME_REQUIRED` | provided name blank | `VALIDATION_ERROR` |
| `INVALID_STATUS` | status outside domain | `VALIDATION_ERROR` |
| `DUPLICATE_NAME` / `DUPLICATE_CODE` / `DUPLICATE_CLUB` | tenant uniqueness | `CONFLICT` |
| `UPDATE_FAILED` | unexpected server error | `INTERNAL_ERROR` |

Client-only codes reused as-is by the 45A.3D wrapper (not server-emitted): `CLUB_REQUIRED` (blank `clubId` before RPC), `CLUB_OUT_OF_SCOPE` (visible-set guard), `TENANT_MISMATCH` (client tenant expectation), `V2_DISABLED` (flag OFF).

---

## 8. Field ownership

**Updatable canonical `public.clubs` columns:** `name`, `code`, `description`, `status`, `registered_cluster_id`.

**Not migrated in this phase** (not columns on `public.clubs` — they live in the legacy blob / club extension and are not modeled canonically): `logo`, `address`, `phone`, `note`, `slug`, `timezone`, `registeredCourtIds`. Migrating them requires new canonical schema (columns or a related table) and is deferred to a later phase; `club_update` deliberately ignores them so it cannot silently drop or half-persist blob-only metadata.

NULL-argument semantics: a `null` argument leaves the field unchanged; empty string clears nullable `code`/`registered_cluster_id` to NULL; `description` accepts empty string; `name` must remain non-empty.

---

## 9. Changed files

| File | Type | Purpose |
|---|---|---|
| `docs/v5/phase45a3c/PHASE_45A3C_CLUB_UPDATE_RPC.sql` | new | canonical `club_update` + audit whitelist patch |
| `docs/v5/phase45a3c/PHASE_45A3C_CLUB_UPDATE_REPORT.md` | new | this report |
| `tests/phase45a3c-club-update-rpc.test.js` | new | SQL contract tests |
| `package.json` | modified | wire the new test into `test:unit` |

No `src/` runtime file changed.

---

## 10. Tests

`tests/phase45a3c-club-update-rpc.test.js` asserts: exactly one new function; exact signature + grant; plpgsql/DEFINER/`search_path public`/`returns json`; auth + request_id + idempotency (`club_update`); row lock; version check + bump; authorization helper set; `club.update` audit + whitelist patch (existing actions preserved); canonical response; field ownership (only the 5 canonical columns; none of the blob-only fields); writes only `public.clubs` (no `club_governance*` / `club_members` writes); status domain; error tokens; no destructive DDL beyond the documented constraint swap.

---

## 11. Build

Foundation Lock, `lint:no-new`, full unit suite, and `build` are run in the pre-commit report. Only a new SQL file, a new test, and a `package.json` test-wiring line are added.

---

## 12. Runtime impact

**None this phase.** No runtime file, UI, context, service, or flag changed. Deploying the SQL to Staging/Production would add the function + audit action but change no behavior until 45A.3D routes traffic to it (and even then only under `VITE_CLUB_STORAGE_V2`).

---

## 13. Rollback

- Repo: revert the branch/PR; no runtime effect.
- If deployed later: `drop function if exists public.club_update(uuid, text, integer, text, text, text, text, text);` and re-apply the prior `audit_logs_action_check` (see `PHASE_42KA_GOVERNANCE_AUDIT_PATCH.sql`). No data is mutated by creating the function.

---

## 14. Risks

- **Audit constraint swap** briefly drops/re-adds `audit_logs_action_check`; the new set is a strict superset of the current one, so no existing action is invalidated.
- **NULL-vs-clear semantics** must be honored by the 45A.3D client wrapper (send only changed fields; pass `''` to clear `code`/cluster). Documented and asserted.
- **Uniqueness** is enforced both by pre-check and by the DB unique indexes (`clubs_tenant_name_uniq`, `clubs_tenant_code_uniq`); the `unique_violation` handler covers the race.

---

## 15. Implementation readiness

**Ready for Phase 45A.3D.** The canonical UPDATE contract now exists and mirrors the deployed command family. 45A.3D can add a `rpcV2ClubUpdate` wrapper in `clubStorageV2RpcService`, route `clubTenantService.updateClub` (and `ClubContext` rename) through it under V2, and cut over create+update together — after this RPC is applied to Staging and verified, then Production.

**Verdict: PASS — READY TO COMMIT** (SQL contract + tests authored; nothing executed/deployed).
