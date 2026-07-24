# E2E-06 — Permission & Tenant Matrix (GOV-09 / GOV-10)

## Enforcement stack

E2E-01 `createCompetitionRuntimePorts` + `authorizeCompetitionAction` (CORE-02) + Identity evidence port.

`rejectClientGrantedPermissions` runs before evidence resolution.

## Action → permissions

| Action | Capability | Permissions (OR via CORE-02) | Elevated |
|--------|------------|------------------------------|----------|
| `governance.read` | competition.governance.read | `tournament.view` | no |
| `governance.reliability.evaluate` | …reliability | `tournament.view`, `director.use` | no |
| `governance.recovery.evaluate` | …recovery | `tournament.update`, `director.use`, `tournament.certify` | yes |
| `governance.replay.evaluate` | …replay | `tournament.view`, `director.use` | no |
| `governance.import.evaluate` | …import | `tournament.update`, `tournament.certify` | yes |
| `governance.export.evaluate` | …export | `tournament.view` | no |
| `governance.archive.evaluate` | …archive | `tournament.update`, `tournament.certify` | yes |
| `governance.evidence.build` | …evidence | `tournament.view`, `director.use` | no |
| `governance.certification.read` | …certification | `tournament.view`, `tournament.certify` | no |

## Isolation rules

- Explicit `tenantId` + `competitionId` required
- Record tenant/competition mismatch → `E2E06_CROSS_TENANT_REJECTED`
- No SUPER_ADMIN hard-coded bypass
- Public projection must not receive private governance payloads (governance is organizer/admin path)
- Referee/player evidence boundaries remain owned by E2E-04; governance does not broaden them
