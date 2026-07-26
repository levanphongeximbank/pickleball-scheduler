# Ownership matrix

| Concern | Owner | Court Engine / Ops role |
|---------|-------|-------------------------|
| Venue / court inventory | Venue Management | Read only |
| Operating hours / availability | Venue Management | Read only via availability guard |
| Court descriptors | Venue Management | Read only |
| Operational court runtime state | Court Operations | Own (`courtStates` in session) |
| Session / queue lifecycle | Court Operations | Own |
| Operational claims | Court Operations (claim lifecycle) | Durable RPC canonical; local only if explicit |
| Cluster inventory / admin CRUD | Court Cluster / Platform | Out of scope (unchanged ownership) |
| Competition demand / assignment / schedule | Competition Engine | Own decisions; no inventory writes |

Court Engine reads Venue inventory/availability through public adapters only. No inventory ownership transfer.
