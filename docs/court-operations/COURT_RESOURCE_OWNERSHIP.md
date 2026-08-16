# Court Resource ownership — 2.2 Court Operations

Canonical freeze: `src/features/court-resource/OWNERSHIP.md`.

```
COURT_RESOURCE_OWNER=2.2_COURT_OPERATIONS
COURT_RESOURCE_GATEWAY_OWNER=2.2_COURT_OPERATIONS
COURT_MASTER_OWNER=2.2_COURT_OPERATIONS
COURT_ACCESS_AUTHORITY_OWNER=2.2_COURT_OPERATIONS
COMPETITION_PROVIDER_BINDING_OWNER=2.2_COURT_OPERATIONS
```

```
TENANT_ID_OWNER=PLATFORM_CANONICAL_ORGANIZATION
VENUE_ID_OWNER=2.1_VENUE_MANAGEMENT
CLUB_ID_OWNER=2.3_CLUB_MANAGEMENT
CLUSTER_ID_OWNER=2.2_COURT_OPERATIONS
PHYSICAL_COURT_ID_OWNER=2.2_COURT_OPERATIONS
CLUB_OPERATIONAL_COURT_ACCESS_OWNER=2.2_COURT_OPERATIONS
TENANT_ID_EQUALS_VENUE_ID_ASSUMPTION=NO
COURT_CLUSTERS_VENUE_ID_SEMANTICS=organization_parent_id_debt
D4_VENUE_BOUNDARY_STATUS=COUPLED_TO_VENUES_AS_TENANT_OUT_OF_SCOPE
NEW_SQL_REQUIRED=NO
```

2.1 Venue Management owns venue identity/lifecycle.  
Platform organization layer owns tenant/organization identity.  
2.3 Club Management owns club identity/lifecycle/membership.  
**Club Management does not own court access.**  
**Venue Management does not own Physical Court identity.**

2.2 Court Operations owns `clusterId` topology, `physicalCourtId`, court inventory, and club→physicalCourt operational access (`court_resource_club_operational_access`).

ClubContext is UI selection only — not Court Operations identity authority.
