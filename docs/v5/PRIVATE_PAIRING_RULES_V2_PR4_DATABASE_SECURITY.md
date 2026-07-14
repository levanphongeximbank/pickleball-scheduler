# Private Pairing Rules V2 — PR-4 Database & Security

| Field | Value |
|-------|-------|
| Branch | `feature/private-pairing-rules-v2` |
| Migration | [`PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql`](./PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql) |
| Apply runbook | [`PRIVATE_PAIRING_RULES_V2_PR4_APPLY_RUNBOOK.md`](./PRIVATE_PAIRING_RULES_V2_PR4_APPLY_RUNBOOK.md) |
| Status | **Local/staging only** — do not apply Production |
| Feature flags | `VITE_PRIVATE_PAIRING_RULES_ENABLED=false`, `VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED=false` |

---

## 1. Architecture choice — Activate conflict detection

**Chosen: Architecture A (trusted app preflight + RPC hash gate).**

1. App loads draft rule set via RPC.
2. App runs PR-2 `validatePrivatePairingRules` + `detectPrivatePairingConflicts`.
3. App computes content hash aligned with SQL `private_pairing_compute_rule_set_hash`.
4. App calls `private_pairing_activate_rule_set(preflight_ok=true, content_hash, validation_report)`.
5. RPC rejects if `preflight_ok` is false, hash mismatches, or `fatalCount > 0`.

**Why not full SQL conflict engine:** avoids duplicating the JS canonical detector and drifting from PR-2. Client cannot activate without the service preflight path (`activatePrivatePairingRuleSetWithPreflight`).

---

## 2. Schema

### Type note

`tenant_id`, `scope_id`, and player ids are **TEXT**, matching `profiles.venue_id` and club/tournament player id conventions (not always UUID).

### Tables

| Table | Purpose |
|-------|---------|
| `private_pairing_rule_sets` | Versioned rule sets (`logical_id` + `version`, status draft/active/archived) |
| `private_pairing_rules` | Individual constraints (soft-delete via `deleted_at`) |
| `private_pairing_rule_targets` | Target players per rule |
| `private_pairing_rule_audit_logs` | Append-only audit |

### Key constraints / indexes

- Unique `(tenant_id, logical_id, version)`
- Partial unique **one active** per `(tenant_id, logical_id)`
- FK rules → rule_sets ON DELETE CASCADE
- FK targets → rules ON DELETE CASCADE
- Unique `(rule_id, target_player_id)`
- Severity/weight/time/visibility/priority/relation_mode CHECKs
- Canonical `constraint_type` list aligned with PR-2

---

## 3. Permissions

| Permission | SUPER_ADMIN / PLATFORM_ADMIN | All other roles |
|------------|------------------------------|-----------------|
| `pairing.private_rules.view` | Yes | No |
| `pairing.private_rules.manage` | Yes | No |
| `pairing.private_rules.audit` | Yes | No |
| `pairing.private_rules.simulate` | Yes | No |

DB seed grants only those role ids; migration **deletes** grants from TECHNICIAN, club, venue, referee, player, etc.

Client matrix: `PLATFORM_ADMIN` gets all permissions; `SYSTEM_TECHNICIAN` curated list does **not** include private pairing.

RPC helper `private_pairing_can(perm)` requires **`is_super_admin()` AND `user_has_permission(perm)`**.

---

## 4. RLS

- RLS enabled on all four tables.
- `authenticated` has **SELECT only** (when policy passes).
- No INSERT/UPDATE/DELETE grants or policies for clients.
- Writes only via SECURITY DEFINER RPCs.
- Select policies require view/audit permission + `private_pairing_tenant_visible(tenant_id)`.
- No `using (true)` policies.

### Tenant visibility

Reuses `user_venue_id()` / `is_super_admin()`.

- Tenant-scoped SUPER_ADMIN (venue_id set): only own `tenant_id`.
- Platform SUPER_ADMIN with **null/empty** venue_id: can see all tenants (same pattern as other platform admin helpers). Cross-tenant is **not** inferred from the role name alone — it requires the existing platform venue_id null convention.

---

## 5. RPCs

| RPC | Permission |
|-----|------------|
| `private_pairing_list_rule_sets` | view |
| `private_pairing_get_rule_set` | view |
| `private_pairing_get_active_rules_for_scope` | view |
| `private_pairing_create_rule_set` | manage |
| `private_pairing_create_rule` | manage |
| `private_pairing_update_rule` | manage (draft only) |
| `private_pairing_disable_rule` | manage (draft only) |
| `private_pairing_clone_rule_set_version` | manage |
| `private_pairing_activate_rule_set` | manage + preflight |
| `private_pairing_rollback_rule_set` | manage |
| `private_pairing_list_audit_logs` | audit |

All: `SECURITY DEFINER`, `search_path = public, pg_temp`, validate `auth.uid()`, tenant, permissions.

`tenant_id` from client is visibility-checked; preferred tenant is `user_venue_id()`.

---

## 6. Versioning

- Draft: editable.
- Active: **not** directly editable (`RULE_SET_NOT_EDITABLE`).
- Clone → new draft version (`version = max+1`).
- Activate → archive previous active for same `logical_id`, then activate (atomic).
- Rollback → clone then activate with reason (history preserved).

---

## 7. Audit

- Every write RPC calls `private_pairing_write_audit` in the same transaction.
- Fields: actor_id, tenant_id, action, reason, before/after, request_id, created_at.
- Triggers block UPDATE/DELETE on audit (`AUDIT_APPEND_ONLY`).
- Hard DELETE on rules blocked (`HARD_DELETE_FORBIDDEN`).

---

## 8. Realtime

**OFF.** Tables are **not** added to `supabase_realtime`. Comments document this. No public broadcast of private rules.

---

## 9. Repository / service

| Module | Role |
|--------|------|
| `repository/privatePairingRulesRepository.js` | Flag-gated RPC wrappers; flag OFF → no queries |
| `repository/mapDbRuleToCanonical.js` | DB → PR-2 contract |
| `services/privatePairingRulesService.js` | Activate with PR-2 preflight + hash |

---

## 10. Error codes (stable)

`PERMISSION_DENIED`, `CROSS_TENANT_ACCESS`, `NOT_FOUND`, `RULE_SET_NOT_EDITABLE`, `RULE_SET_CONFLICT`, `SELF_TARGET_NOT_ALLOWED`, `DUPLICATE_TARGET`, `EMPTY_TARGET_LIST`, `INVALID_TIME_RANGE`, `SCOPE_ID_REQUIRED`, `SOFT_WEIGHT_REQUIRED`, `HARD_WEIGHT_NOT_ALLOWED`, `REASON_TEXT_REQUIRED`, `FEATURE_DISABLED`, …

---

## 11. Known limitations

- Staging JWT role probes require owner apply confirm (not auto-applied in PR-4).
- Full conflict engine lives in app (Architecture A); SQL only gates activate.
- Player membership cross-checks (player in tenant) deferred where no shared player registry FK exists.
- UI SUPER_ADMIN is PR-5.
- Production apply is out of scope.

---

## 12. Rollback notes

See runbook. Core: drop RPCs → drop policies → drop tables (audit retained if needed) → delete permission grants. Never apply rollback on Production without owner GO.
