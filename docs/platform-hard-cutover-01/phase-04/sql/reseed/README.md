# Reseed package — deterministic post-wipe initialization

**NOT executed** in Phase 4 / pre-Staging remediation PR. Owner GO required for Staging/Production.

See also: `00_ORDER_AND_SAFETY.md`

## Order

1. Owner tenant preserved (`01_OWNER_TENANT_VERIFY_ONLY.sql`) — VERIFY ONLY
2. Club (`02_CLUB.sql`)
3. Venue clusters (`03_VENUE.sql`)
4. Courts (`04_COURTS.sql`)
5. Player (`05_PLAYER.sql`) — no Auth invent
6. Rating profile (`06_RATING_PROFILE.sql`)
7. Competition (`07_COMPETITION.sql`) — M8 required
8. Participants (`08_PARTICIPANTS.sql`)
9. Schedule (`09_SCHEDULE.sql`)
10. Match (`10_MATCH.sql`)
11. Finalized result (`11_FINALIZED_RESULT.sql`) — **only** `competition_ssot_finalize_match_result`
12. Public Catalog (`12_PUBLIC_CATALOG.sql`)
13. Customer (`13_CUSTOMER.sql`)
14. CRM (`14_CRM.sql`)
15. Finance (`15_FINANCE.sql`)
16. News (`16_NEWS.sql`)
17. Coaching first-use (`17_COACHING_FIRST_USE.sql`)
99. Verify (`99_VERIFY_RESEED.sql`)

## Rules

- Idempotent keys: `hard-cutover-seed::{tenant}::{entity}`
- Do **not** create Auth users
- Do **not** change Owner UUID
- Do **not** mutate protected objects
- Verify with `99_VERIFY_RESEED.sql`
