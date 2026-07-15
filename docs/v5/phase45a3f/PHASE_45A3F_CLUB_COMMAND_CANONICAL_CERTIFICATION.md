# PHASE 45A.3F — Club Create/Update Command Canonical Certification

**Status:** Level A architecture lock & certification  
**Scope:** Club entity **create/update** command ownership only  
**Not claimed complete:** archive/delete, VP/owner governance commands, Membership Commands, blob-only metadata command plane

---

## 1. Final contract

| Concern | Authority |
|--------|-----------|
| **SSOT** | `public.clubs` |
| **Read gateway** | `canonicalClubRepository` (read-only) |
| **Command orchestrator** | `clubTenantService` (`createClub` / `updateClub`) |
| **RPC transport** | `clubStorageV2RpcService` |
| **Canonical commands** | `club_create`, `club_update` |
| **Offline / V2-OFF surface** | `clubOfflineCommandAdapter` only (UI-facing) |
| **Cloud authority gate** | `clubLegacyWriteGuard` (`isClubCloudCommandAuthoritative`) |

**Production cloud path:**

```
UI / ClubContext / venue-owner
      ↓
clubTenantService
      ↓
clubStorageV2RpcService
      ↓
club_create / club_update
      ↓
public.clubs
```

---

## 2. Retired cloud paths (V2 + Supabase)

These must **not** act as Production Club entity writers when Club Storage V2 is authoritative:

- `persistClubToCloud`
- `club_upsert_registry` / `rpcClubUpsertRegistry`
- `rpcClubClaimSelfRegistration`
- `syncClubsForVenueToCloud` / `syncClubsToLegacyRegistry`
- `bootstrapSelfRegisteredPresident` / `finalizeSelfRegisteredClubCloud`
- `saveClubs` / `updateClubMeta` after successful `club_create` / `club_update`
- Direct domain Club writers from UI/context
- Silent blob success after cloud RPC failure

Runtime hard-block: `assertLegacyClubEntityWriteAllowed` → `FEATURE_DISABLED`.

---

## 3. Deferred boundaries (explicitly out of this certification)

| Boundary | Status | Notes |
|----------|--------|-------|
| Archive / hard-delete | Deferred | Blocked under V2; soft deactivate via `club_update` status remains |
| VP / owner / approve governance writers | Deferred | Local `updateClubMeta` / gated legacy upsert; not create/update SoT |
| Blob-only `note` / timezone / slug / logo / `registeredCourtIds` | Deferred | Via offline `updateClubMeta` / scheduling blobs — not `public.clubs` fields |
| Membership Commands | Deferred | Separate phase |

---

## 4. Residual allowed locations (not Production cloud entity authority)

| Class | Location | Why retained |
|-------|----------|--------------|
| B | `clubOfflineCommandAdapter`, `domain/clubService`, tenant V2-OFF branches | Explicit rollback / no-Supabase |
| B | `clubRegistryCloudService` / Rpc / Sync | Legacy dual-write, gated under V2 |
| C | ClubManagement note / `importFullClubData` | Separate blob domain |
| D | `deleteClub` paths | Archive/delete phase |
| E | Governance service writers | VP/owner/approve phase |
| F | Seeds + unit tests | Dev/test fixtures |
| G | `data/club.js` `addClub`/`removeClub`, unused reclaim helper | Superseded; not cloud authority |

**No unexplained (H) Club entity write plane.**

---

## 5. CI ownership locks (Phase 45A.3F additions)

Existing 45A.1–45A.3E Club rules retained. **Added:**

| Rule id | Purpose |
|---------|---------|
| `club-entity-rpc-transport-only` | `club_create`/`club_update` RPC only in `clubStorageV2RpcService` |
| `club-entity-rpcV2-orchestrator-only` | `rpcV2ClubCreate`/`Update` calls only from `clubTenantService` (+ transport defs) |
| `club-entity-legacy-persist-call-surface` | `persistClubToCloud` only in approved legacy/V2-OFF files |
| `club-entity-repository-readonly` | `canonicalClubRepository` must not grow command writers |

Exact allowlists only; no wildcard suppression. Read-path baseline debt (ClubContext/Players `loadClubs`) remains Phase 45A.5.

---

## 6. Production evidence (prior phases — verified, not re-executed here)

| Item | Evidence |
|------|----------|
| Merge PR #21 (45A.3D runtime) | `c440639` on `main` |
| Merge PR #22 (45A.3E retirement) | `24f07bf` on `main` |
| Production V2 flag | `VITE_CLUB_STORAGE_V2=true` (shipped bundle) |
| CI after #22 | Production CI Gate **1964/1964**, SUCCESS |
| Runtime wiring | Bundle contains `club_create`/`club_update` + legacy `FEATURE_DISABLED` gates |
| Authenticated create/update mutation | **NOT EXECUTED BY DESIGN** (verification phases) |

This 45A.3F change set is **certification + CI lock only** — **no intended runtime behavior change**.

---

## 7. Rollback contract

1. Revert this PR merge commit on `main`.
2. Runtime create/update and V2-OFF gates from 45A.3D/3E remain until those PRs are also reverted.
3. Emergency offline: `VITE_CLUB_STORAGE_V2=false` restores adapter/legacy path (flag change is an ops decision, not part of this PR).

---

## 8. Residual risks

- Governance/VP local writers under V2 without cloud dual-write until governance command phase.
- Soft-deactivate vs hard-delete UX until archive/delete RPCs.
- Blob note still writable locally under V2 (intentional deferred metadata).
- Authenticated Production create/update mutation still needs separate authorized QA when required.

---

## 9. Certification statement

**Club entity create/update command ownership is certified for Production cloud mode:**

`canonicalClubRepository` (read) + `clubTenantService` → `clubStorageV2RpcService` → `club_create`/`club_update` → `public.clubs`, with `clubOfflineCommandAdapter` as the only UI-facing offline rollback surface.

**This does not certify** full Club Commands completeness beyond create/update.
