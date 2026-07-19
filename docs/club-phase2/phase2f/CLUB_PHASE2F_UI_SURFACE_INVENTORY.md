# Club Phase 2F — UI Surface Inventory

| ID | Surface | Route | Component | Parent | Data hook/service | Classification |
|----|---------|-------|-----------|--------|-------------------|----------------|
| S1 | Club Home summary | `/my-club` | `MyClubSummaryCard` | `MyClubPage` | `useGovernanceReadModel` | **CANONICAL** |
| S2 | Assign owner dialog | `/my-club` | `AssignClubOwnerDialog` | `MyClubPage` | `assignClubOwner` | **CANONICAL** |
| S3 | My Club Governance | `/my-club` gated | `MyClubGovernancePanel` | `MyClubPage` | `useGovernanceReadModel` | **CANONICAL** |
| S4 | Org Chart | `/my-club?view=schedule` | `MyClubOrgChart` | `MyClubSchedulePanel` | `useGovernanceReadModel` | **CANONICAL** |
| S5 | Members badges | `/my-club?view=members` | `MyClubMembersPanel` | `MyClubPage` | `resolveMemberGovernanceRoleLabel` + list members | **CANONICAL** |
| S6 | Manage Overview gov | `/manage/clubs/:clubId` | `ClubGovernancePanel` | `ClubOverviewTab` | `useGovernanceReadModel` | **CANONICAL** |
| S7 | Manage Members roles | `?tab=members` | `ClubMembersTab` | `ClubDetailPage` | canonical membership + role labels | **CANONICAL** |
| S8 | Discover cards | `/discover-clubs` | `MyClubDiscoverPanel` / `ClubCard` | `DiscoverClubsPage` | V2 list RPC `presidentLabel` | **PARTIALLY_CANONICAL** |
| S9 | Manage club list | `/manage/clubs` | `ClubListPage` | router | registry `ownerName`/`presidentName` | **PARTIALLY_CANONICAL** |
| S10 | Platform clubs | `/platform/clubs` | `PlatformClubsPage` | router | registry (platform scope) | **PARTIALLY_CANONICAL** |
| S11 | Join panel president | join flows | `MyClubJoinPanel` | discover/join | summary helper | **PARTIALLY_CANONICAL** |
| S12 | Club form create | manage dialogs | `ClubFormDialog` | list/create | create-path governance fields | **LEGACY** (create) / writers 2D |
| — | Legacy `/club` | `/club` | `ClubManagement` | — | none for gov display | **NOT_PRODUCTION_REACHABLE** (no gov UI) |
| — | `profiles.club_id` | — | — | — | ignored | **UNSAFE** if used as SoT (not used) |

Desktop: S1–S11 via `MainLayout`.  
Mobile/PWA: same routes; bottom nav / drawer reach `/my-club` and related Club paths when authenticated.
