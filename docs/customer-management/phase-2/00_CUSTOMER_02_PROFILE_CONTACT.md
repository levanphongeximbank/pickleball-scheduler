# CUSTOMER-02 — Customer Profile & Contact Fast Track

## Purpose

Hoàn thiện domain capability **Customer Master Profile** và **Customer Contact Management** trên nền CUSTOMER-01 (canonical foundation). Không tạo module Customer thứ hai.

**Baseline:** CUSTOMER-01 merge trên `origin/main` (PR #211).

## Ownership boundary

### CUSTOMER-02 owns

- displayName / individual name / organization name / legalName / preferredName
- EMAIL and PHONE contact points (identity, normalization, primary, lifecycle, verification **state**)
- postal/business address **contract** (minimal value object)
- profile update + revision/version
- CustomerProfileView / CustomerContactView
- deterministic validation + typed domain failures

### CUSTOMER-02 does **not** own

- Identity credentials / login email-phone / OTP / verification runtime
- Player sports profile / rating
- CRM lead/prospect/campaign/interaction
- Finance transactions / Club membership
- Notification delivery / privacy policy / consent governance engine
- SQL / Supabase / RLS / UI / routes / Production-Staging rollout

> Customer contact information is business master data. It is not an authentication credential and does not prove ownership or verification without trusted external evidence.

## Profile model

### Individual (`CUSTOMER_TYPE.INDIVIDUAL`)

- Top-level: `displayName` (required or derivable), `legalName` optional
- `individualProfile`: `{ givenName, familyName, middleName?, preferredName? }`
- Display derivation order when `displayName` omitted: `preferredName` → `givenName middleName familyName`
- `organizationProfile` forbidden (`PROFILE_TYPE_MISMATCH`)

### Organization (`CUSTOMER_TYPE.ORGANIZATION`)

- Top-level: `displayName` (required or derivable), `legalName` optional
- `organizationProfile`: `{ organizationName, tradingName? }`
- Display derivation: `organizationName` → `tradingName`
- `individualProfile` forbidden
- CUSTOMER-01 displayName-only org rows remain valid (`organizationProfile` may be null)

### Type consistency

- Changing `customerType` after create is **fail-closed** (`PROFILE_TYPE_MISMATCH`)
- Immutable: `customerId`, `customerNumber`, tenant/venue scope

## Contact model

Each contact point:

| Field | Notes |
|-------|--------|
| contactPointId | Stable opaque id (not array index) |
| type | `EMAIL` \| `PHONE` |
| normalizedValue | Comparison key |
| displayValue | Presentation |
| value | Alias of `normalizedValue` (CUSTOMER-01 compat) |
| purpose / label | Controlled: GENERAL, BILLING, OPERATIONS, OTHER |
| primary | Boolean |
| verificationState | UNVERIFIED \| VERIFIED \| FAILED \| REJECTED |
| status | ACTIVE \| INACTIVE |
| createdAt / updatedAt / version | Clock-injectable |

### Email normalization

- trim → lowercase
- pragmatic pattern `local@domain.tld`
- reject blank / invalid → `INVALID_EMAIL`
- duplicate active normalized email on same customer → `DUPLICATE_CONTACT_POINT`

### Phone normalization

- trim displayValue (preserve formatting)
- strip separators; keep leading `+` (or convert leading `00` → `+`)
- require 7–15 digits
- **no** auto trunk-to-country mapping (e.g. `0` → `+84`)
- reject blank / invalid → `INVALID_PHONE`
- duplicate active normalized phone on same customer → `DUPLICATE_CONTACT_POINT`

### Primary-contact invariants

- At most **one primary ACTIVE EMAIL**
- At most **one primary ACTIVE PHONE**
- Setting primary clears other primaries of the **same type** only
- Removing / deactivating a primary does **not** auto-select another
- Inactive contacts cannot become primary

### Verification-state boundary

- Default: `UNVERIFIED`
- Application/domain must **not** mark `VERIFIED` without `trustedEvidence: true`
- Changing contact value resets verification to `UNVERIFIED`
- No OTP / email-verify / SMS-verify runtime in CUSTOMER-02

## Address scope

Minimal value object only:

- `addressId`, `addressType` (POSTAL|BUSINESS|BILLING|OTHER)
- `addressLine1`, optional `addressLine2`, `locality`, `adminArea`, `postalCode`
- `countryCode` (ISO alpha-2, default `VN`)
- `primary`, `status` (ACTIVE|INACTIVE), timestamps/version

No geocoding, map integration, or address verification runtime. At most one primary ACTIVE address.

## Application services

Facade: `createCustomerApplicationService` (extended, not duplicated).

Commands (additive):

- `updateCustomerProfile` (+ `expectedVersion`)
- `getCustomerProfile` / `getCustomerContacts`
- `addEmail` / `updateEmail` / `removeEmail` / `deactivateEmail` / `setPrimaryEmail`
- `addPhone` / `updatePhone` / `removePhone` / `deactivatePhone` / `setPrimaryPhone`
- `addAddress` / `updateAddress` / `removeAddress` / `setPrimaryAddress`
- Existing CUSTOMER-01 contact/linkage commands retained

## Typed errors (additive)

`INVALID_CUSTOMER_PROFILE`, `PROFILE_TYPE_MISMATCH`, `INVALID_EMAIL`, `INVALID_PHONE`, `INVALID_ADDRESS`, `DUPLICATE_CONTACT_POINT`, `CONTACT_POINT_NOT_FOUND`, `PRIMARY_CONTACT_CONFLICT` — plus CUSTOMER-01 codes (`NOT_FOUND`, `VERSION_CONFLICT`, scope errors, …).

## Deferred / non-goals

- Durable SQL / Supabase / RLS / indexes
- Cross-customer global dedupe / merge runtime
- Booking / club-blob migration
- CRM workflow changes, UI, routes
- Email verification / phone OTP / notification delivery
- Production rollout

## Known legacy adoption gaps

- `src/models/customer.js` still uses `name`/`phone` venue operational shape — not SoT
- Booking denormalized name/phone untouched
- Identity login email/phone remains Identity-owned
- Player profile name/contact remains Player-owned
- CRM `ContactReference` continues to reference opaque `customerId` only

## CUSTOMER-03 entry criteria

CUSTOMER-03 (persistence / adoption) may open when:

1. CUSTOMER-02 merged (or Owner-approved)
2. Owner confirms persistence approach (tables vs dual-write with club blob)
3. Legacy id + booking name/phone compatibility plan approved
4. CRM `VenueCustomerDirectoryPort` wiring plan approved
5. Finance external CUSTOMER reference mapping reviewed
6. No Production/Staging activation in the same change set as schema authoring
