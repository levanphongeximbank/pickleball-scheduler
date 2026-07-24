# E2E-02 → E2E-03 Readiness

## Ready after E2E-02 merge

E2E-03 (Organizer Operations MVP) can start consuming:

- `resolveIndividualPoolKnockoutTemplate`
- `instantiateIndividualPoolKnockoutTemplate`
- `createPoolKnockoutRuntimeComposition`
- `composeIndividualPoolKnockout`

## Contract inputs for Organizer path

1. Select IND Pool+KO template for tenant/competition.
2. Instantiate → apply CM-02 patches into draft definition/config.
3. Register participants (CORE registration/eligibility — already CLOSED).
4. Call composition with `deterministicSeed` + tenant/competition identity.
5. Drive pool match lifecycle → accepted results → qualification → knockout.
6. Publish/archive via existing CM-06/CM-08 (wiring remaining under BG-07 remainder).

## Still out of E2E-02 / deferred to later waves

- Organizer / Player / Referee portals
- Score-entry UI
- Public Live Score / Match Center
- Notification delivery
- Production deploy / Staging SQL

## Parallelization note

After E2E-02 merge and contract freeze:

- E2E-04 (Player/Referee) and E2E-05 (Public Experience) may run in parallel with care once match/standings/bracket contracts from E2E-03 stabilize.
- E2E-03 remains the hard sequential gate before full ops certification path.
