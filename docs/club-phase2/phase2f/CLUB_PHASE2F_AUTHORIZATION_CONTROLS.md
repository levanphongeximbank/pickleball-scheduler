# Club Phase 2F — Authorization Control Matrix (UI visibility)

Client helpers are **visibility only**. Server RPC authz remains authoritative (Phase 2D).

| Actor | Assign owner | Transfer owner | Transfer president | Set/clear VP | Delete club | View gov labels |
|-------|--------------|----------------|--------------------|--------------|-------------|-----------------|
| Platform / SA | Visible if `canAssignClubOwner` | Per helper | Per helper | If manage | Per delete | Yes |
| Tenant owner | Assign yes | Yes (show transfer) | Yes | Yes | Policy | Yes |
| Club owner | Assign usually no (1C) | Transfer UI if eligible | Yes | Yes | Yes | Yes |
| President | No | No | Relinquish/transfer yes | Yes | No | Yes |
| Vice President | No | No | No | No | No | Yes (member) |
| Club manager | No (unless also officer) | No | No | No | No | Policy |
| Regular member | No | No | No | No | No | Summary yes |
| Non-member | No | No | No | No | No | Discover labels only |
| Cross-tenant | No | No | No | No | No | Denied hydration |

| Check | Result |
|-------|--------|
| Hidden ≠ authorized | PASS (documented) |
| Direct route still server-enforced | PASS (2D) |
| No client spoof elevates write | PASS |
| Clear president UI absent | PASS (transfer-only) |

**CODE_CERTIFIED** via helper exports + panel wiring tests. Live role matrix smoke → FU-2F-1.
