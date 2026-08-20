# Staging acceptance checklist (after live read-only preflight)

Not executed in this implementation pass.

- [ ] Confirm `tenant_members` readable for a staging operator JWT
- [ ] Actor A cannot open Tenant B
- [ ] F5 does not restore unauthorized persisted tenant
- [ ] Authority query failure shows unresolved/unavailable, not empty clubs
- [ ] VENUE_MANAGER cannot operate a foreign venue/club
- [ ] CLUB_MANAGER cannot operate a foreign club
- [ ] Super Admin directory works without fabricated first tenant/venue
- [ ] Super Admin mutation requires explicit target
- [ ] SYSTEM_TECHNICIAN cannot operate arbitrary clubs/venues/tenants
- [ ] Identity admin with RPC missing fails closed (no broad profiles select)
- [ ] Venue-independent page works without selected Venue
- [ ] Logout / user switch clears scope hints
- [ ] Contract #01 tests still pass
- [ ] No Staging mutation in Wave 4 implementation
