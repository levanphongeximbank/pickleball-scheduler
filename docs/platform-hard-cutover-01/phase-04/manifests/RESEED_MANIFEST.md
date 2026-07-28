# Reseed Manifest

See `sql/reseed/README.md`, `sql/reseed/00_ORDER_AND_SAFETY.md`, and `sql/reseed/99_VERIFY_RESEED.sql`.

Deterministic order:

1. Owner tenant — VERIFY ONLY
2. Club
3. Venue
4. Courts
5. Player (no Auth invent)
6. Rating profile
7. Competition
8. Participants
9. Schedule
10. Match
11. Finalize — SSOT RPC only
12. Public Catalog
13. Customer
14. CRM
15. Finance
16. News
17. Coaching first-use
99. Verify

Not executed in Phase 4 / pre-Staging remediation PR.
