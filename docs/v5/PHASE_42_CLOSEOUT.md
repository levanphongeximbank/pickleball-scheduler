# Phase 42 — Club Platform Rebuild — CLOSEOUT

**Status:** **Phase 42 CLOSED**  
**Close date:** 2026-07-11  
**Final Production commit (42M UI):** `13955f9b5ba0b5c28955246fea9ae1379ec931b9`  
**Production URL:** https://pickleball-scheduler-eight.vercel.app  
**Production deployment (42M):** `dpl_GiuiviLhLAvc3tBRn6tBhqndcCKE`  
**Rollback reference (pre-42M):** `dpl_2UDJ7MTYw9AgJFn4fGLWWE6Z5yas`

---

## 1. Mục tiêu ban đầu Phase 42

Chuyển **Club domain** từ local-first / legacy blob sang **Cloud SSOT** trên Supabase PostgreSQL:

- Membership thật qua `club_members` (không `profiles.club_id`)
- Governance qua `club_governance_assignments`
- Mutations qua **canonical RPC** + idempotency + version
- Registry tenant/platform read model
- Navigation & route guards nhất quán (42L)
- Professional Club UI (42M)

**Không** nằm trong Phase 42: operational data (booking, court blob, tournament blob) — deferred Phase 43+.

Spec: [`PHASE_42_CLUB_STORAGE_CLEAN_RESET.md`](./PHASE_42_CLUB_STORAGE_CLEAN_RESET.md)

---

## 2. Kiến trúc trước / sau

| | Trước (pre-42) | Sau (Phase 42 closed) |
|---|----------------|------------------------|
| Club registry SoT | `pickleball-clubs-v1` local + `club_upsert_registry` | Cloud `clubs` + `club_list_registry` RPC |
| Membership | `profiles.club_id`, athlete link store | `club_members` + `club_get_my_active_membership` |
| Governance | Ad-hoc / legacy | `club_governance_assignments` + RPC |
| Mutations | Mixed direct / legacy RPC | Canonical V2 RPC (`clubStorageV2RpcService.js`) |
| UI | Per-page ad hoc | `src/features/club/ui/*` design system (42M) |
| Flag | — | `VITE_CLUB_STORAGE_V2=true`, `VITE_RBAC_ENABLED=true` |

Operational data (players/bookings/tournaments in blob) **unchanged** — see §15.

---

## 3. Cloud SSOT — Club Domain

- PostgreSQL tables: `clubs`, `club_members`, `club_governance_assignments`, membership requests
- Client V2: [`PHASE_42F_CLIENT_V2.md`](./PHASE_42F_CLIENT_V2.md)
- RPC SQL: [`PHASE_42C_RLS_RPC.sql`](./PHASE_42C_RLS_RPC.sql)
- Schema: [`PHASE_42B_SCHEMA.sql`](./PHASE_42B_SCHEMA.sql)

---

## 4. Membership V2

- SoT: `club_members` (active status)
- RPC: `club_submit_membership_request`, `club_review_membership_request`, `club_leave_membership`, `club_get_my_active_membership`
- Session: strips legacy `profiles.club_id` when V2 (`authStorage.js`)
- Cache: sessionStorage membership cache (non-authoritative)

Phases: 42I, 42J (redirect/RPC dedup), 42J2 (landing/cache polish)

---

## 5. Governance — owner / president / VP

RPCs: `club_assign_owner`, `club_clear_owner`, `club_transfer_president`, VP assign/remove (Phase 42G+)

Explicit clear semantics — null payload does not wipe governance (spec §0).

Doc: [`PHASE_42G_CLUB_CREATE_OWNER.md`](./PHASE_42G_CLUB_CREATE_OWNER.md)

---

## 6. Membership request review

- President/VP review via `club_review_membership_request` with `p_request_id`, `p_expected_version`
- UI: `MyClubMembershipRequestsPanel.jsx` — confirm reject dialog (42M)

---

## 7. Audit log

- Server-side audit on Phase 42 RPCs (SQL)
- Client identity audit: `auditService.js` / `identity_list_audit_logs`

---

## 8. Orphan cleanup

- Phase 42H: orphan profile links — [`PHASE_42H_ORPHAN_PROFILE_LINKS.md`](./PHASE_42H_ORPHAN_PROFILE_LINKS.md)
- `clearAthleteClubLink` on V2 session restore

---

## 9. Routes — My Club / Discover

- PLAYER no membership → `/discover-clubs` (42J landing)
- Active member → `/my-club`
- Deep links guarded — 42J2.1 stabilization

---

## 10. Registry — tenant / platform

- Tenant registry: `club_list_registry` with `p_tenant_id`
- Platform SA: `/platform/clubs` cross-tenant read
- Tenant owner: `/manage/clubs`; platform route shows guard (42L case 4)
- Read model: [`PHASE_42K_REGISTRY_READ_MODEL.md`](./PHASE_42K_REGISTRY_READ_MODEL.md)

---

## 11. Navigation 42L

Matrix documented: [`PHASE_42L_NAVIGATION.md`](./PHASE_42L_NAVIGATION.md)

Production rebaseline PASS: `docs/v5/qa-evidence/phase42l-production/PHASE_42L_PRODUCTION_SMOKE_REBASELINE.json`

---

## 12. Professional Club UI — 42M

- Commit: `13955f9b5ba0b5c28955246fea9ae1379ec931b9`
- Doc: [`PHASE_42M_CLUB_UI.md`](./PHASE_42M_CLUB_UI.md)
- Blueprint: [`PHASE_42X_CLUB_UX_BLUEPRINT.md`](./PHASE_42X_CLUB_UX_BLUEPRINT.md)
- Components: `src/features/club/ui/*`
- Unit tests: `tests/phase42m-club-ui.test.js`

---

## 13. Migration / RPC / commit / deployment references

| Milestone | Reference |
|-----------|-----------|
| Staging reset | `PHASE_42_BACKUP_2026-07-10_STAGING.md`, `PHASE_42E_RESET.sql` |
| Production backup | `PHASE_42_BACKUP_2026-07-10_PRODUCTION.md` |
| Client V2 GO | `PHASE_42F_CLIENT_V2.md` |
| Registry 42K | `PHASE_42K_PRODUCTION_CLOSEOUT.md` |
| 42L nav Production | commit `0153dbf`, deployment `dpl_2UDJ7MTYw9AgJFn4fGLWWE6Z5yas` |
| **42M UI Production** | commit `13955f9`, deployment `dpl_GiuiviLhLAvc3tBRn6tBhqndcCKE` |
| Preview 42M | `dpl_Ev83SXFLFwQsCxonbfETyMSL92ZT` |
| Branch | `v5-platform-edition` |

---

## 14. QA summary

### Preview (42M)

| | |
|---|---|
| Report | `docs/v5/qa-evidence/phase42m-preview/PHASE_42M_PREVIEW_QA_REPORT.json` |
| Verdict | **PASS** (groups A–I) |
| Desktop + mobile | ✅ |
| Personas | president, member, no-member, tenant owner, SA |

### Production (42M smoke)

| | |
|---|---|
| Report | `docs/v5/qa-evidence/phase42m-production/PHASE_42M_PRODUCTION_SMOKE_REPORT.json` |
| Verdict | **PASS** (10/10 cases, pageErrors=0) |
| Groups | A My Club, B mobile, C Discover, D Members, E Requests, F Manage, G Platform, H regression 42L |

### Production (42L rebaseline)

| | |
|---|---|
| Verdict | **PASS** (cases 1, 4, 6, 10) |

### Tenant isolation / route guards

- Staging QA: Phase 42L preview cases 8–12
- Production: case H menu matrix PASS; manage guard PASS (42M smoke F)

### Bundle env (informational)

Separate probe confirms `VITE_CLUB_STORAGE_V2=true`, `VITE_RBAC_ENABLED=true` on Production bundle (`bundle-env-probe.mjs`).

---

## 15. Known limitations (Phase 42N / 42Z audit)

Phase 42 **closed Club domain rebuild** — **not** whole-app architecture compliance:

| Area | Status | Doc |
|------|--------|-----|
| Operational Data (booking, court, customer, tournament blob) | **NON-COMPLIANT** | `PHASE_42N_ARCHITECTURE_AUDIT.md` |
| Offline queue tenant isolation | **P0** — Phase 43A | `PHASE_43A_SAFETY_PREP.md` |
| Direct table mutations (check-in, billing, …) | **P0/P1** | `PHASE_43A_DIRECT_MUTATION_INVENTORY.md` |
| Dual architecture (V2 RPC + legacy blob code paths) | Contained when V2 on; code remains | 42N |
| Whole V5 Data & Sync score | ~46/100 | 42N verdict C |

**Next phase:** 43A Data Safety (no feature expansion).

---

## 16. Rollback references

| Target | Deployment ID |
|--------|---------------|
| Pre-42M Production (42L) | `dpl_2UDJ7MTYw9AgJFn4fGLWWE6Z5yas` |
| Current 42M Production | `dpl_GiuiviLhLAvc3tBRn6tBhqndcCKE` |

```text
vercel rollback dpl_2UDJ7MTYw9AgJFn4fGLWWE6Z5yas
```

Database: Phase 42 schema/RPC already on Production — rollback is **client-only** unless Owner runs SQL rollback (not part of 42M).

Phase docs: `PHASE_42J_ROLLBACK.md`, `PHASE_42J1_ROLLBACK.md`

---

## 17. Final status

```text
╔══════════════════════════════════════╗
║   PHASE 42 — CLUB PLATFORM REBUILD   ║
║            STATUS: CLOSED              ║
╚══════════════════════════════════════╝
```

**Gate open for:** Phase 43A implementation (`GO PHASE 43A IMPLEMENT`)  
**Not open for:** Phase 43B operational SSOT, Phase 43T pilot coding — until 43A safety PASS

---

## Sub-phase index (42A–42M)

| Phase | Focus |
|-------|-------|
| 42A–42E | Staging schema, RLS, RPC, reset |
| 42F | Client V2 flag |
| 42G | Club create / owner |
| 42H | Orphan profile links |
| 42I / 42J / 42J2 | Membership flow, redirect, RPC dedup, landing |
| 42K | Registry read model |
| 42L | Navigation matrix Production |
| 42M | Professional Club UI |
| 42N / 42Z | Architecture audit (post-close reference) |
