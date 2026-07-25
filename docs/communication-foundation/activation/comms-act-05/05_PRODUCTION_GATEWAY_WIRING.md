# COMMS-ACT-05 — Production Gateway Wiring

## Server path

`createTrustedCommunicationBackend` wires:

- `createSupabaseCommunicationRepositories(client)`
- `createDirectMessagingApplication` / `createClubCommunicationApplication`
- `createSupabaseClubMembershipReader`
- `createClubManagerAccessPolicy` + team policy
- Idempotency ledger

## Browser path

`createTrustedBackendHttpMessagingGateway`:

- Implements Experience Gateway methods needed for write smoke
- Calls `POST /api/communication/command`
- Community methods fail-closed
- Realtime subscribe = manual refresh only
- Network errors → `PERSISTENCE_UNAVAILABLE` (never local success)

## Runtime provider

`CommunicationRuntimeProvider` opts in only when:

`VITE_COMMUNICATION_TRUSTED_BACKEND=true`

Then it may set `productionDependenciesCertified` + `createProductionGateway` to the HTTP gateway.

Default without flag: unchanged COMMS-07 behavior (dev DEMO / prod UNAVAILABLE). Activation gates `STAGING_MIGRATION_READY` / `PRODUCTION_READY` remain **false** until a later Owner gate.

## Composition root

Trusted backend composition is **server-only**. Browser never imports a module that constructs a service-role client.
