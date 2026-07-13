# CC-10 Stage 1B — Live Fixtures

**Prefix:** `CC10-STAGE1-LIVE-`

| Entity | ID |
|---|---|
| Tenant | `CC10-STAGE1-LIVE-tenant` |
| Tournament | `CC10-STAGE1-LIVE-tournament` |
| Player | `CC10-STAGE1-LIVE-player-1` |
| Player rating row | `CC10-STAGE1-LIVE-pr-1` |
| Match (rating test) | `CC10-STAGE1-LIVE-match-1` |
| BYE match | `CC10-STAGE1-LIVE-bye-1` |

Adapter matrix cases use in-memory `CC10-STAGE1-` fixtures (no DB writes).

Rating fixtures seeded via service-role REST for isolated RPC verification; **cleaned up** after tests.

No Production or real customer data used.
