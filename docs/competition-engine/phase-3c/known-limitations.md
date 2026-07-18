# Known Limitations — Phase 3C

1. No Production callers — capability-only.
2. Persistence is stub/in-memory only; never Production.
3. Eligibility engine / fee gates not executed in Registration Runtime (Format remains owner).
4. Withdrawal workflow (S1-G) not a separate registration kind — status map only.
5. Daily Play has no Entry/Registration path.
6. `SUBMITTED` supported for team/raw sources; individual S1-B primarily uses `pending`.
7. Proxy `registeredByPlatformUserId` mapped when present; Production submit often omits it.
8. Team waitlist supported in mapper; Production TT path is primarily team create.
9. Root export + official manifest deferred to Integrator.
10. No Canonical Registration adapter / executor in this phase.
