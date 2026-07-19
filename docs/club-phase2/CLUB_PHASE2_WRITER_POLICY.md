# Club Phase 2B — Writer Policy (Single Writer)

**Status:** FROZEN / **LOCKED** (documentation only)  
**Date:** 2026-07-19  
**Authority:** Phase 2B Domain & API Freeze  
**Phase status:** 2A CLOSED · 2B LOCKED · Next: **2C** (not started)  
**Related:** [READ_WRITE_OWNERSHIP.md](./READ_WRITE_OWNERSHIP.md), [CLUB_PHASE2_DOMAIN_FREEZE.md](./CLUB_PHASE2_DOMAIN_FREEZE.md)  
**Cardinality:** Captain **0..N** (+ optional primary) · Coach **0..N**

---

## 1. Policy statement

For every Phase 2 Club entity there is **exactly one Production authoritative writer path** when Club Storage V2 is on.  
Duplicate writers are **debt**. They must be listed, deprecated, and removed by the named phase.

---

## 2. Entity writer matrix

### 2.1 Club

| Item | Value |
|------|--------|
| **Canonical writer** | `clubTenantService` → `clubStorageV2RpcService` → `club_create` / `club_update` |
| **Current duplicates** | `clubOfflineCommandAdapter` + `domain/clubService`; legacy `persistClubToCloud` / `club_upsert_registry`; occasional governance `updateClubMeta` for blob-only fields |
| **Deprecate** | All cloud registry upsert paths when V2 ON (`clubLegacyWriteGuard`) |
| **Transitional adapter** | `clubOfflineCommandAdapter` for V2-OFF / no-Supabase only |
| **Cutover condition** | V2 ON + 45A.3F certification remains green |
| **Removal phase** | **2G** (legacy registry writers); offline adapter retained behind explicit non-Prod flag |

### 2.2 Club Membership

| Item | Value |
|------|--------|
| **Canonical writer** | Membership services → `club_add_member` / `remove` / `restore` / `leave` (+ approve/accept side effects) |
| **Current duplicates** | `clubExtensionStorage.members`; approve paths that dual-write local; any blob player “member” inference |
| **Deprecate** | Extension member writers under V2 ON; Phase 31 RPC service |
| **Transitional adapter** | Local extension only when V2 OFF |
| **Cutover condition** | Membership command certification (Phase **2C**) |
| **Removal phase** | **2G** |

### 2.3 Join Request

| Item | Value |
|------|--------|
| **Canonical writer** | `clubMembershipRequestService` → V2 request RPCs |
| **Current duplicates** | Phase 31 `clubMembershipRequestRpcService`; local extension requests |
| **Deprecate** | Phase 31 client on V2 ON |
| **Transitional adapter** | None in Production |
| **Cutover condition** | V2 request RPCs sole path (**2C**) |
| **Removal phase** | **2G** |

### 2.4 Invitation

| Item | Value |
|------|--------|
| **Canonical writer** | New Club invitation service → new `club_invitation_*` RPCs |
| **Current duplicates** | None (entity missing). Tournament invite helper is **not** a writer |
| **Deprecate** | Misuse of tournament member list as “invitation” |
| **Transitional adapter** | None — ship cloud-first (**2E**) |
| **Cutover condition** | Table + RPCs + API freeze compliance + gates |
| **Removal phase** | N/A (new) |

### 2.5 Governance Assignment

| Item | Value |
|------|--------|
| **Canonical writer** | `clubGovernanceService` → owner/president/VP RPCs (1B/1C gated) |
| **Current duplicates** | Local `club.governance` JSON writers; legacy `club_governance` table upsert; registry cloud dual-write |
| **Deprecate** | Local-as-SoT under V2 ON |
| **Transitional adapter** | Read merge adapters until assignments always returned by `club_get` |
| **Cutover condition** | Governance write certification (**2D**) |
| **Removal phase** | **2G** |

### 2.6 Captain Assignment

| Item | Value |
|------|--------|
| **Cardinality** | **0..N** captains; optional `is_primary`; no single-Captain model |
| **Canonical writer** | New roster assignment service → RPCs on `club_roster_assignments` (`captain`) |
| **Current duplicates** | `updateClubMemberRole` → extension `role: captain` |
| **Deprecate** | Local role field as SoT |
| **Transitional adapter** | Optional read fallback local→cloud during 2E flag roll |
| **Cutover condition** | Cloud assign/list/clear working; UI uses freeze APIs |
| **Removal phase** | **2G** (local role write) |

### 2.7 Coach Assignment

| Item | Value |
|------|--------|
| **Cardinality** | **0..N** coaches; no single-Coach model; specialization later as metadata only |
| **Canonical writer** | Same roster assignment plane (`coach`) |
| **Current duplicates** | Local `role: coach` |
| **Deprecate** | Local role SoT |
| **Transitional adapter** | Same as Captain |
| **Cutover condition** | Same as Captain (**2E**) |
| **Removal phase** | **2G** |

---

## 3. Non-Club writers (must stay non-Club)

| Concern | Canonical writer module | Club action if duplicate today |
|---------|-------------------------|--------------------------------|
| Player profile | Player | Stop treating blob `players[]` as SoT (**2F**) |
| Rating | Competition / Rating | Stop dual club-extension Elo as Product SoT (**2F** decision) |
| Ranking | Ranking | Club display-only |
| Tournament | Competition | Move create path out of Club (**2F**) |
| Booking / courts | Venue | Extract from blob (**2F**/Venue track) |
| Notification records | Notification | Club only via API |
| Finance ledger | Finance | Club must not post |

---

## 4. Transitional adapter rules

1. Adapters may **read** legacy and map to freeze DTOs.  
2. Adapters must **not** accept new feature writes on legacy SoT.  
3. When V2 ON, adapter write attempts → `FEATURE_DISABLED`.  
4. Dual-write (cloud + local) is **forbidden** for new entities (Invitation, roster assignments).  
5. Existing dual-write for membership/governance must be collapsed in **2C/2D**, not extended.

---

## 5. Cutover checklist (per entity)

- [ ] Single RPC/service path documented  
- [ ] Legacy path hard-gated under V2 ON  
- [ ] Tests/cert doc (45A.3F-style) for commands  
- [ ] Audit events firing  
- [ ] expected_version + idempotency verified  
- [ ] Peer imports updated to public reads only  
- [ ] Acceptance gates green  

---

## 6. Removal phase map

| Writer class | Remove in |
|--------------|-----------|
| Phase 31 membership RPC client | 2C / 2G |
| Extension `members[]` writes (V2 ON) | 2C / 2G |
| Legacy registry cloud upsert | 2G |
| Local governance JSON as SoT | 2D / 2G |
| Local captain/coach role writes | 2E / 2G |
| Club blob as peer SoT | 2F / 2G |
| Raw peer `rpcV2*` dependence | 2G |

**Writer policy is LOCKED for Phase 2B exit.**
