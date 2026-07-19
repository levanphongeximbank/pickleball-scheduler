# Club Phase 2D — Authorization Matrix

| Actor | assignOwner | clearOwner | assignPresident (transfer) | clearPresident | assignVp | clearVp |
|-------|-------------|------------|----------------------------|----------------|----------|---------|
| Platform administrator | ALLOW | ALLOW | ALLOW | DENY (transfer-only) | ALLOW | ALLOW |
| Tenant owner | ALLOW | ALLOW | ALLOW | DENY | ALLOW | ALLOW |
| Club owner | DENY (server 1C) | DENY | ALLOW | DENY | ALLOW | ALLOW |
| President | DENY | DENY | ALLOW | DENY | ALLOW | ALLOW |
| Vice president | DENY | DENY | DENY | DENY | DENY | DENY |
| Club manager | DENY | DENY | DENY | DENY | DENY | DENY |
| Regular member | DENY | DENY | DENY | DENY | DENY | DENY |
| Non-member | DENY | DENY | DENY | DENY | DENY | DENY |
| Cross-tenant | DENY | DENY | DENY | DENY | DENY | DENY |

Server helpers: `phase42_can_assign_club_owner`, `phase42_can_transfer_president` (2D SQL), `phase42_can_manage_vice_presidents`.
