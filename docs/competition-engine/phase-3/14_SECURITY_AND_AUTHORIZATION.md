# 14 — Security and Authorization

**Status:** Design only  
**Invariant:** Canonical runtime must not trust UI role checks as the security boundary.

---

## Controls that must survive migration

```text
RLS
RBAC
Tenant isolation
Competition scope
Actor permissions
Captain permissions
Referee permissions
Owner approvals
Auditability
```

---

## Where authorization lives

| Layer | Responsibility |
|-------|----------------|
| **Before orchestrator** | Authn session; route guards; coarse RBAC |
| **Application service** | Command authorization (actor can do X on competition Y) |
| **Repository boundary** | RLS / tenant predicates on every read/write |
| **Combined** | **Required** — defense in depth |

UI checks are UX only.

---

## Capability notes

| Capability | Auth concern |
|------------|--------------|
| Participant | Prevent cross-tenant athlete linkage |
| Registration | Actor vs entry owner; fee/waitlist abuse |
| Roster | Captain/deputy only; club membership |
| Lineup | Hidden lineup visibility; lock override roles |
| Scoring | Referee/director token-scoped RPCs (existing v3.5.6 pattern) |
| Publication | Who can publish/reopen |
| Kill switch | SUPER_ADMIN / SYSTEM_TECHNICIAN / OWNER_APPROVED_OPERATOR only |

---

## Migration-specific risks

| Risk | Mitigation |
|------|------------|
| Dual-write leaks tenant | RLS on both stores; mapping scoped by tenant |
| Shadow logs PII | Hash/redact |
| Flag elevation by Venue Owner | Role matrix in `10` |
| Core trusting UI payload roles | Strip roles; resolve actor server-side / service-side |

---

## Referee / live path

Existing token-scoped RPCs (`referee_get_match_by_token`, `referee_update_match_score`) must remain the boundary for live scoring during 3J — Core must call ports, not open anon table access.
