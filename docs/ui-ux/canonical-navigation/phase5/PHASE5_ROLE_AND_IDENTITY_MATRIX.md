# Phase 5 Role and Identity Matrix — Preview Acceptance

**Program:** PICK_VN Canonical Navigation  
**Phase:** 5 — Preview acceptance readiness  
**Environment target:** Staging Supabase + Vercel/Netlify Preview (never Production accounts)  
**Credentials policy:** Do **not** publish passwords. Operator uses local Staging QA vault / `.env.staging-qa.local` (gitignored).  
**Account creation in this audit:** **NO**

Machine-readable: [`PHASE5_ROLE_AND_IDENTITY_MATRIX.json`](./PHASE5_ROLE_AND_IDENTITY_MATRIX.json)

---

## Summary

| Classification | Count |
|----------------|------:|
| READY | 5 |
| READY_WITH_LIMITATIONS | 2 |
| MISSING | 2 |
| NOT_REQUIRED | 0 |
| **Audited** | **10** |

---

## Identity inventory

### Unauthenticated visitor

| Field | Value |
|-------|-------|
| Classification | **READY** |
| Account | None |
| Environment | Preview |
| Tenant | N/A |
| Expected menu | Public portal surfaces only; no authenticated shell menu |
| Hidden items | All authenticated leaves |
| Tournament access | Public catalog `/tournaments`, `/tournaments/` only |
| Rating V5 `/player/skill-assessment-v5` | Deny → login / unauthenticated deny |
| Private Pairing | Deny |
| Credentials available | N/A |

### PLAYER — `player@staging.local`

| Field | Value |
|-------|-------|
| Classification | **READY** |
| Environment | Staging + Preview |
| Tenant | `venue-staging-a` / `club-staging-a` |
| Expected menu | Player leaves (profile, schedule, player tournaments, rating where entitled) |
| Hidden | Admin, CRM manage, Private Pairing, Engine manage tabs in general menu |
| Tournament | Player tournament leaves; Engine write denied without `tournament.update` + ownership |
| Rating V5 | Enrolled → allow when V5 flag ON; not enrolled → deny/unavailable; flag OFF → controlled unavailable |
| Private Pairing | Hidden / deny |
| Credentials | Operator Staging vault (not in report) |

### VENUE_OWNER — `owner@staging.local`

| Field | Value |
|-------|-------|
| Classification | **READY** |
| Environment | Staging + Preview |
| Tenant | `venue-staging-a` |
| Expected menu | Venue ops, CRM (where permitted), tournaments manage when ownership matches |
| Hidden | Private Pairing; platform admin; B03 shadow menu |
| Tournament | Engine allowed when ownership/tenant matches + `tournament.update` |
| Rating V5 shadow | Deny (not admin / not PLAYER enrolled path) |
| Private Pairing | Deny |
| Cross-tenant control | Use `owner-b@staging.local` / `venue-staging-b` for denial |

### VENUE_MANAGER — `manager@staging.local`

| Field | Value |
|-------|-------|
| Classification | **READY** |
| Environment | Staging + Preview |
| Tenant | `venue-staging-a` |
| Expected menu | Venue manager subset (ops, limited finance/report per RBAC matrix) |
| Hidden | Platform admin; Private Pairing; B03 menu |
| Tournament | Per permission + ownership |
| Rating V5 shadow | Deny |
| Private Pairing | Deny |

### CLUB_OWNER — `club@staging.local`

| Field | Value |
|-------|-------|
| Classification | **READY** |
| Environment | Staging + Preview |
| Tenant | `venue-staging-a` / `club-staging-a` |
| Expected menu | Club + tournament club-scope leaves |
| Hidden | Private Pairing; CRM venue-only where not entitled; B03 menu |
| Tournament | Club-scoped Engine when ownership allows |
| Rating V5 shadow | Deny |
| Private Pairing | Deny |

### CLUB_MANAGER

| Field | Value |
|-------|-------|
| Classification | **READY_WITH_LIMITATIONS** |
| Documented identity | `manager@futurearena.local` (often **dev** tenant, not Staging seed table) |
| Staging seed gap | No first-class `club-manager@staging.local` in v3.5.8 Staging table |
| Environment | Dev fallback and/or Staging if Owner maps CLUB_OWNER≈manager alias |
| Expected menu | Similar to club management subset |
| Limitation | Preview Staging browser cell may need Owner mapping or waiver |
| Tournament / Rating V5 / Pairing | Club-scope; shadow deny; pairing deny |

### REFEREE — `referee@staging.local` (+ token flows)

| Field | Value |
|-------|-------|
| Classification | **READY_WITH_LIMITATIONS** |
| Environment | Staging + Preview |
| Tenant | Assignment-scoped |
| Expected menu | Referee zone leaves |
| Hidden | Admin, Private Pairing, CRM, Engine manage |
| Tournament | Referee portals / assigned matches; Engine manage denied |
| Rating V5 shadow | Deny |
| Private Pairing | Deny |
| Limitation | Legacy token referee path still exists; session login QA separate |

### COACH

| Field | Value |
|-------|-------|
| Classification | **MISSING** |
| Account availability | No documented `coach@staging.local` in Staging QA tables reviewed |
| Environment | N/A until provisioned |
| Expected menu | Coaching leaves only |
| Hidden | Engine manage, Private Pairing, B03, CRM admin |
| Tournament / Rating / Pairing | Unrelated deny for Engine manage & pairing & B03 |
| Credentials | Not available |
| Owner decision | Provision Staging COACH **or** waive Preview cell (unit suite covers unrelated deny) |

### PLATFORM_ADMIN

| Field | Value |
|-------|-------|
| Classification | **MISSING** |
| Account availability | No dedicated Staging PLATFORM_ADMIN email documented |
| Environment | N/A until provisioned |
| Expected menu | Near-platform admin (not full SUPER_ADMIN founder tools where separated) |
| B03 Rating V5 | **Allow** even when V5 flag OFF (OD-B03) |
| Private Pairing | Typically allow with pairing flags (global role) — confirm on Preview flags |
| Credentials | Not available |
| Owner decision | Provision Staging PLATFORM_ADMIN **or** waive browser cell; SUPER_ADMIN cannot fully substitute for distinct PLATFORM_ADMIN assertion |

### SUPER_ADMIN — `admin@staging.local`

| Field | Value |
|-------|-------|
| Classification | **READY** |
| Environment | Staging + Preview |
| Tenant | Global |
| Expected menu | Full canonical menu (**76** leaves when flags allow; Private Pairing only if pairing flag ON) |
| Hidden | B03 shadow never in menu/search |
| Tournament | Engine authorized (global) |
| Rating V5 | Allow direct URL even when V5 flag OFF |
| Private Pairing | Visible/accessible when `VITE_PRIVATE_PAIRING_RULES_ENABLED` ON |
| Credentials | Operator Staging vault |

---

## Feature-flag interactions (Preview)

| Flag | Preview note |
|------|--------------|
| `VITE_CANONICAL_APP_SHELL_ENABLED` | Target **ON** for Phase 5 acceptance |
| `VITE_RBAC_ENABLED` | Expect **ON** for Staging Preview (historical Staging QA) |
| `VITE_PICK_VN_RATING_V5_ENABLED` | Exercise ON and OFF cells for B03 |
| `VITE_PRIVATE_PAIRING_RULES_ENABLED` | Required ON to assert pairing menu visibility for SUPER_ADMIN |

Do not change Production values.

---

## Credentials safety

- Do not embed passwords in evidence MD/JSON.  
- Do not use Production accounts unless Owner explicitly approves (default: **NO**).  
- Do not create accounts during this audit.  
- Password suggestions in older Staging docs are operator lore only — rotate/store privately.
