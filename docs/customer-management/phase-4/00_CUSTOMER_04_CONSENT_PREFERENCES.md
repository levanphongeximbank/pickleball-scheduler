# CUSTOMER-04 — Consent & Communication Preferences

## Purpose

CUSTOMER-04 completes Customer Consent and Communication Preferences as a
canonical Customer Management domain capability:

- consent business state (grant / deny / revoke / expire);
- communication preference by purpose × channel;
- effective timestamps, source, and evidence references;
- append-only history;
- fail-closed communication eligibility projection;
- durable persistence extension on CUSTOMER-03;
- read-only Notification and CRM boundary adapters.

**Customer Management stores consent and communication preference facts. It does
not independently determine legal permission when Platform Governance policy
input is required.**

**Notification may consume communication eligibility but must not mutate
Customer consent state directly.**

## Ownership boundary

### CUSTOMER-04 owns

- customer consent business state and history;
- customer communication preference business state and history;
- purpose / channel / status contracts used by Customer;
- eligibility projection from business facts (fail-closed);
- typed domain errors and reason codes;
- Customer-owned persistence tables + trusted RPCs;
- Customer-owned CRM / Notification read adapters.

### CUSTOMER-04 does not own

| Concern | Owner |
|---------|--------|
| Privacy policy, lawful basis, retention, deletion | Platform Governance |
| Message delivery, templates, queue, worker, providers | Notification |
| Campaign / lead / targeting / care workflows | CRM |
| Login email/phone, OTP, auth verification | Identity |
| Finance / Competition Engine | Finance / Competition |

## Consent vs preference

| Concept | Meaning |
|---------|---------|
| **Consent** | Recorded business fact that Customer granted, denied, revoked, or expired permission evidence for a purpose (optionally channel-scoped). |
| **Preference** | Customer desire for a purpose × channel (`OPTED_IN` / `OPTED_OUT` / `UNSPECIFIED`). |
| **Eligibility** | Fail-closed projection from facts. Never equates `OPTED_IN` alone to legal permission. |

Foundation overlay enums (`CUSTOMER_CONSENT_STATE` OPT_IN/OPT_OUT/UNKNOWN on
aggregate jsonb) remain for CUSTOMER-01/02 compatibility. CUSTOMER-04 current
state uses:

- Consent: `GRANTED` / `DENIED` / `REVOKED` / `EXPIRED` (`NOT_RECORDED` = absence)
- Preference: `OPTED_IN` / `OPTED_OUT` / `UNSPECIFIED`

## Channel and purpose model

Channels (reuse Customer uppercase contract; Notification maps lowercase later):

- `EMAIL`, `SMS`, `PHONE`, `PUSH`

Purposes:

- `MARKETING`, `SERVICE`, `EVENT_UPDATE`, `BOOKING_UPDATE`,
  `COMPETITION_UPDATE`, `MEMBERSHIP_UPDATE`

`MARKETING` requires Governance policy resolution before eligibility can become
`ELIGIBLE` even when preference/consent appear positive
(`REQUIRES_POLICY_DECISION`).

## State transitions

Consent transitions (current-state):

- absent/`NOT_RECORDED` → `GRANTED` | `DENIED`
- `GRANTED` → `REVOKED` | `EXPIRED` | `DENIED`
- `DENIED` → `GRANTED` | `REVOKED`
- `REVOKED` → `GRANTED` | `DENIED`
- `EXPIRED` → `GRANTED` | `DENIED`
- Double revoke → `CONSENT_ALREADY_REVOKED`

Grant requires opaque `evidenceReference` (no raw evidence payload).

Preference uniqueness: one active row per `customer + purpose + channel (+ scope)`.

## Eligibility semantics

Outcomes: `ELIGIBLE` | `INELIGIBLE` | `REQUIRES_POLICY_DECISION`

Fail-closed reasons include missing customer, inactive/missing contact,
unverified contact when required, opted-out / unspecified preference, denied /
revoked / expired / missing consent, unsupported channel/purpose, Governance
policy required.

`ELIGIBLE` requires preference `OPTED_IN` **and** consent `GRANTED` (and
Governance gate cleared when applicable).

## Evidence handling

- Store opaque `evidenceReference` only.
- No provider credentials, message bodies, or sensitive raw evidence in Customer.

## Append-only history

- `customer_consent_history` / `customer_preference_history`
- Deterministic `sequence`, previous/next status, source, actor, evidence ref,
  aggregate version, effective timestamp
- SQL immutable triggers block UPDATE/DELETE

## Persistence model

Ordering (after CUSTOMER-03 pack):

1. `10_CUSTOMER_PHASE_4_TABLES.sql`
2. `20_CUSTOMER_PHASE_4_INDEXES.sql`
3. `30_CUSTOMER_PHASE_4_RLS.sql`
4. `40_CUSTOMER_PHASE_4_SAVE_RPC.sql`
5. `50_CUSTOMER_PHASE_4_GRANTS.sql`
6. `60_CUSTOMER_PHASE_4_HISTORY_IMMUTABLE.sql`
7. `90_CUSTOMER_PHASE_4_ROLLBACK.sql` (disable/drop)
8. `99_CUSTOMER_PHASE_4_VERIFICATION.sql`

Depends on CUSTOMER-03 `customers` table. If CUSTOMER-03 is not live, do not
apply CUSTOMER-04.

## RLS model

- Reuses `customer_phase3_scope_allows`
- Authenticated SELECT with `customer.view` / `customer.edit` / super_admin
- No authenticated writes; trusted `service_role` RPCs only
- No anonymous access; no `USING (true)`

## Notification boundary

`createCustomerNotificationEligibilityAdapter` — read-only eligibility /
channel projection. Does not mutate consent. Does not enable delivery.

## CRM boundary

`createCustomerCrmConsentPreferenceAdapter` — read consent/preference summary
and eligibility facts. CRM commands must go through Customer application
boundary (not direct DB).

## Governance dependency

Platform Governance owns regulatory interpretation. When policy input is
missing for marketing-class purposes, eligibility returns
`REQUIRES_POLICY_DECISION`.

## Migration apply status

- **Authored only** in this workstream
- Not applied to Staging or Production
- Live database verification deferred until Owner gate + CUSTOMER-03 applied

## Rollback strategy

1. Soft disable: drop SELECT policies, revoke grants, revoke RPC execute
2. Hard rollback (Owner-gated): drop CUSTOMER-04 triggers/functions/tables only

## Staging checklist

1. CUSTOMER-03 pack applied + verification PASS
2. Owner authorizes CUSTOMER-04 apply
3. Apply 10→60 in order
4. Run `99_CUSTOMER_PHASE_4_VERIFICATION.sql`
5. Runtime remains gated (no Production memory fallback)

## Production blockers

- CUSTOMER-03/04 not applied
- Authenticated write policies not authorized
- Governance policy port not wired for marketing legal decisions
- Notification delivery not enabled by this pack (by design)

## CUSTOMER-05 entry criteria

See `07_CUSTOMER_05_ENTRY_CRITERIA.md`.

## Deferred roadmap

- Live email/SMS/push delivery
- Notification worker / campaign execution
- CRM targeting engine
- OTP / Identity verification
- Legal-policy engine
- UI / preference center
- Staging/Production apply without Owner gate
- Legacy customer / booking migration
- Customer merge runtime
