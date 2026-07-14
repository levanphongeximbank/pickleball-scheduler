# Private Pairing Rules V2 — Staging QA

| Field | Value |
|-------|-------|
| Date | 2026-07-14 |
| Branch | `feature/private-pairing-rules-v2` |
| Committed HEAD (at staging complete) | see RELEASE_READINESS (updated on finalize commit) |
| Staging project | `qyewbxjsiiyufanzcjcq` |
| Production | **NOT touched** |
| Preview | Staging Preview (Vercel Preview env) |

---

## 1. Environment

| Flag | Preview (Staging) | Production |
|------|-------------------|------------|
| `VITE_PRIVATE_PAIRING_RULES_ENABLED` | `true` (set 2026-07-14) | unchanged / not set by this GO |
| `VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED` | `true` (set 2026-07-14) | unchanged / not set by this GO |
| `VITE_RBAC_ENABLED` | `true` (Preview override 2026-07-14; Production entry left separate) | **not modified** |

Note: Vercel CLI treats these as Sensitive; `vercel env pull` shows blank placeholders. Values were set via `vercel env add … preview` and take effect on Preview builds.

---

## 2. Migration

| Item | Result |
|------|--------|
| File | `docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql` |
| Staging apply | **PASS** (Management API; MCP CallMcpTool blocked after auth) |
| Raise patch | `docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4_RAISE_PATCH.sql` → **PASS** (P0001 `AUDIT_APPEND_ONLY`) |
| Production apply | **NOT APPLIED** |

Evidence:

- `docs/v5/qa-evidence/phase-private-pairing-staging/STAGING_SECURITY_VERIFY.json`
- `docs/v5/qa-evidence/phase-private-pairing-staging/STAGING_RAISE_PATCH_APPLY.json`

### Verification matrix (staging DB)

| Check | Result |
|-------|--------|
| Tables (4) | PASS |
| Indexes (incl. one-active unique) | PASS |
| FKs cascade rules→set / targets→rule | PASS |
| RLS enabled + SELECT-only policies | PASS |
| Authenticated DML grants absent | PASS |
| RPCs (11 user-facing) | PASS |
| Permissions SUPER_ADMIN / PLATFORM_ADMIN only | PASS |
| Realtime publication rows | **0** PASS |
| Audit append-only | PASS (P0001 after raise patch) |

---

## 3. Preview

| Item | Value |
|------|-------|
| Stable alias | https://pickleball-scheduler-levanphongeximbank-pickleball-scheduler.vercel.app |
| Deployment URL (post-flag redeploy; re-check after finalize commit) | see RELEASE_READINESS |
| Route baked in build | `/admin/ai-pairing/private-rules` (`PrivatePairingRulesAdminPage-*.js`) |
| Menu config | Quản trị → Quy tắc ghép cặp riêng (`admin-private-pairing-rules`) |

---

## 4. QA matrix

### 4a. SUPER_ADMIN (Preview + Staging flags)

| Case | Result | Notes |
|------|--------|-------|
| Menu visible under Quản trị | **OWNER_MANUAL** | Config present; requires live SA login on Preview |
| Direct route opens | **OWNER_MANUAL** | Route + FeatureGate require RBAC + SA |
| Non-SA menu hidden | **CODE_PASS** | `roles: PLATFORM_ADMIN/SUPER_ADMIN` in `adminMenu.js` |
| Non-SA route deny | **CODE_PASS** | `SuperAdminRouteGuard` → `/403` when RBAC on |
| Create draft / rules / ANY_OF / ALL_OF / clone / activate / rollback / audit | **OWNER_MANUAL** | UI wired to PR-4 RPCs; needs JWT SA session |
| Active not editable | **CODE_PASS** | RPC `RULE_SET_NOT_EDITABLE` + UI draft gate |
| Cross-tenant blocked | **CODE_PASS** | RPC `private_pairing_tenant_visible` / `CROSS_TENANT_ACCESS` |
| Direct table client writes blocked | **STAGING_PASS** | grants verify SELECT-only |

### 4b. Runtime (unit / flags ON)

| Case | Result | Evidence |
|------|--------|----------|
| Hard rules reject | **PASS** | `tests/private-pairing-rules-pr3-runtime.test.js` |
| Soft rules score only | **PASS** | same |
| Deterministic seed | **PASS** | same |
| Certified/Official preference blocked unless disclosed+allowed | **PASS** | same |
| No active ruleset → no crash | **PASS** | same |
| No legacy duplicate scoring with flags ON | **PASS** | PR-3 AI scoring guards |

### 4c. Mobile

| Device | Result |
|--------|--------|
| iPhone Safari | **OWNER_MANUAL** — checklist in §7 of RELEASE_READINESS |
| Desktop Chrome | **OWNER_MANUAL** — same |

### 4d. Automated tests (this GO)

| Suite | Result |
|-------|--------|
| PR-2 / PR-3 / PR-4 / PR-5 unit | **48/48 PASS** |
| Pairing + intervention regression | **PASS** (see evidence) |
| Targeted pairing ESLint | **0 errors / 0 warnings** |
| Full `src` ESLint errors | **99** (baseline 125 → fewer; **new errors = 0**) |
| `npm run build` | **PASS** |

---

## 5. Known limitations

1. Live browser SUPER_ADMIN / non-admin / mobile UI flows require owner login on Preview (no credentials in agent session; Vercel protection may apply).
2. MCP `execute_sql`/`apply_migration` client registration failed in parent session; staging SQL used approved Management API fallback (same class as prior staging scripts).
3. Branch history also contains Individual Tournament S1 commits from an earlier “commit all” finalize; this GO did **not** modify those areas.
4. Sensitive env pull cannot confirm flag string values in plaintext; redeploy after `vercel env add` is the verification path.

---

## 6. Rollback (staging)

See Production runbook staging section. Short form:

1. Set Preview flags `VITE_PRIVATE_PAIRING_RULES_ENABLED=false` and `VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED=false`, redeploy Preview.
2. Optionally drop `private_pairing_*` RPCs/tables on staging (runbook).
3. Do **not** rollback Production (not applied).
