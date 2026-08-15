# Official/Open Owner fixture referee identity rebind 01

**STAGING-ONLY OPERATOR PACKAGE. NEVER RUN IN PRODUCTION.**

This package repairs only Owner fixture
`a5d7661a-6967-4f12-86f6-fd92a2d30de9`.

Read-only inspection proved two unique existing platform accounts:

- Referee 01: `ca78575b-c5bf-4d32-bd7c-cc3027fea2a5`
  (`tt418.referee01@staging.local`)
- Referee 02: `8bb178b3-c0d8-4965-848d-2de9d73fa9d6`
  (`tt418.referee02@staging.local`)

Both accounts are confirmed `auth.users` rows with matching active
`public.profiles` REFEREE identities in `venue-staging-a`.

## Exact mutation

`02_APPLY.sql` performs one row-locked, version-checked operator CAS:

- GA-R1-M1, GA-R2-M1, GA-R3-M1 → Referee 01 canonical UUID
- GB-R1-M1, GB-R2-M1, GB-R3-M1 → Referee 02 canonical UUID
- writes the same UUID to each assignment and its denormalized
  `match.referee.canonicalUserId`
- increments the existing canonical Tournament version from 23 to 24

It does not alter tokens, courts, schedule, score, result, draw, match status,
or create live rows. It is not a generic identity backfill.

The normal authenticated `canonical_tournament_update` RPC cannot be invoked
from a migration/SQL-editor operator session because its permission boundary
depends on authenticated JWT claims. This operation therefore mirrors its
row-lock, expected-version, one-row CAS, version increment, and `updated_at`
semantics while applying stricter fixture-specific fingerprint checks.

## Cryptographic payload proof

Hashes are `encode(digest(payload::text, 'sha256'), 'hex')` from pgcrypto.

- `EXPECTED_PRE_PAYLOAD_HASH=56f466152e7cdf3197873136b0620bc4d6d757f08d2a69de315dc9f015391cfd`
- `EXPECTED_POST_PAYLOAD_HASH=233df3d9994d4f26715d48ffd9e80f97337b5126322ff5112faec6533f27182e`
- `EXPECTED_PROTECTED_PROJECTION_HASH=56f466152e7cdf3197873136b0620bc4d6d757f08d2a69de315dc9f015391cfd`

The protected projection is the full payload after deleting only the twelve
authorized `canonicalUserId` paths (six assignment records and six matching
`match.referee` copies). PRECHECK, locked APPLY, and VERIFY all require the
same protected hash, which proves the mutation is identity-only.

## Live-row race

APPLY locks the exact canonical Tournament row `FOR UPDATE`, then rechecks
`tournament_match_live` count = 0 before mutating. Official live-row creators
use the same canonical row lock, so a live insert cannot land between that
zero-live check and commit.

## Execution

Only after separate Owner GO, and only after discovery PRECHECK/APPLY/VERIFY
all pass:

1. `01_PRECHECK.sql`
2. `02_APPLY.sql`
3. `03_VERIFY.sql`

Stop immediately on any failure. This package intentionally has no generic
rollback: identity rebinding must not be silently reversed after acceptance.
