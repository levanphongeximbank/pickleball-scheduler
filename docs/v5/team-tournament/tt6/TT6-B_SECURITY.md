# TT-6B — Security

- RLS before publication (`TT6-B_REALTIME_SECURITY.sql`)
- No client subscribe to lineup rows — matchup/sub_match hints only
- `get_visible_lineups` remains authoritative for captain opponent visibility
- Outbox/inbox/command log **not published**
- Referee scope via existing assignment RLS + adapter (no second channel)

Staging verify: `TT6B_SECURITY_REPORT.json`
