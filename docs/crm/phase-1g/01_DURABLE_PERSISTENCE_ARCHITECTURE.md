# 01 — Durable Persistence Architecture (Phase 1G)

**Status:** Implemented (authored adapters + SQL; not applied)

---

## Boundary

```
Application service
  -> repository contract (Phase 1F)
  -> durable repository adapter (Phase 1G)
  -> CrmDatabaseClientPort
  -> (future) concrete database driver / Supabase client adapter
```

Domain models and application services **must not** import a concrete Supabase client.

## Approved reuse

- TenantVenueScope, ContactReference, Lead, Opportunity
- CrmTag, TagAssignment, ConsentRecord, PendingEventRecord
- CRM permissions / error codes / CrmClock / CrmIdGenerator
- Existing repository contracts and memory repositories
- Phase 1F application services
- Fail-closed authorization, MODEL 1 command-returns-events
- Event-envelope validation; no best-effort rollback

## Database client port

`requireCrmDatabaseClientPort` validates an injectable port with:

| Method | Role |
|--------|------|
| `select` | Scoped reads |
| `insert` | Creates (batch-capable) |
| `update` | Conditional updates |
| `delete` | Assignment removal only |
| `rpc` | Claim / release RPCs |

No module-global client. No live connection created by CRM.

## Adapters

| Factory | Contract |
|---------|----------|
| `createDurableTagRepository` | CrmTagRepository |
| `createDurableTagAssignmentRepository` | CrmTagAssignmentRepository |
| `createDurableConsentRepository` | CrmConsentRepository |
| `createDurablePendingEventRepository` | CrmPendingEventRepository |

Memory repositories remain available and are the **default runtime composition** in Phase 1G.

## Transaction rules

- Prefer single-table / single-aggregate repository methods.
- Pending-event enqueue uses one insert batch (all-or-nothing).
- Claim / release use RPCs with row locks.
- No unsafe multi-aggregate application writes introduced.
