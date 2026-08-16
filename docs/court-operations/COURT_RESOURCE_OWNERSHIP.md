# Court Resource ownership — 2.2 Court Operations

Canonical freeze: `src/features/court-resource/OWNERSHIP.md`.

```
COURT_RESOURCE_OWNER=2.2_COURT_OPERATIONS
COURT_RESOURCE_GATEWAY_OWNER=2.2_COURT_OPERATIONS
COURT_MASTER_OWNER=2.2_COURT_OPERATIONS
COURT_ACCESS_AUTHORITY_OWNER=2.2_COURT_OPERATIONS
COMPETITION_PROVIDER_BINDING_OWNER=2.2_COURT_OPERATIONS
```

2.1 Venue Management owns venue identity/lifecycle.  
Platform organization layer owns tenant/organization identity.  
2.3 Club Management owns club identity/lifecycle/membership.  
**Club Management does not own court access.**  
**Venue Management does not own Physical Court identity.**

2.2 Court Operations owns `clusterId` topology, `physicalCourtId`, court inventory, and club→physicalCourt operational access (`court_resource_club_operational_access`).
