# 02 — Source of Truth Boundaries

## Customer Management owns

- `customerId`, `customerNumber`
- Customer master profile
- Display / legal name
- `customerType` (`INDIVIDUAL` | `ORGANIZATION`)
- Status lifecycle
- Contact points
- Classification / segment references / controlled tags
- Communication preference + consent **business state/refs**
- Linkages: user account, player, organization
- Search/read of customer master data
- Merge/dedupe **contract** (foundation)

## Customer Management does not own

### CRM

Lead, prospect, opportunity, campaign, pipeline, interaction, follow-up, sales assignment, retention campaign, care workflow.

### Player Management

Player profile, sports/competition data, participant mapping, player privacy projection, athlete lifecycle.

### Identity / Platform Core

Authentication, credentials, session, account security, roles, permissions, tenant authorization.

### Finance

Payment, invoice, receivable, refund, ledger, settlement, balances, transaction history.

### Club Management

Club membership, member role, club governance, org structure.

### Platform Governance

Privacy policy, retention/deletion policy, regulatory consent governance rules.

## Compatibility statement

Legacy venue customers (`src/models/customer.js` / club blob) remain operational until a dedicated adoption phase. CRM/Finance continue to hold **references only**.
