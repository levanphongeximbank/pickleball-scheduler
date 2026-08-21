# Wave 5 — Production predecessor variants & transfer-president authz lock

```
OWNER_GO=WAVE5_PRODUCTION_PREDECESSOR_VARIANT_AND_TRUNCATE_SECURITY_REMEDIATION_GO
ARCHITECTURE_DECISION=WAVE4_TENANT_MEMBERS_SUPERSEDES_PHASE2D_PROFILES_VENUE_ROLE_FALLBACK
TRANSFER_PRESIDENT_PROFILES_VENUE_ROLE_FALLBACK=RETIRE
TENANT_OPERATIONAL_ENTITLEMENT=tenant_members
LIVE_HASH_IS_CANONICAL_AUTHORITY=NO
REPO_CANONICAL_TARGET_IS_AUTHORITY=YES
WAVE5_CANONICAL_TARGET_AUTHORITY_CHANGED=NO
LEGACY_PROFILES_VENUE_ROLE_FALLBACK_REINTRODUCED=NO
ENVIRONMENT_NAME_NOT_USED_TO_SELECT_HASH=YES
UNKNOWN_PREDECESSOR_HASH_ABORTS=YES
TARGET_HASH_NOT_USED_AS_PREDECESSOR=YES
STAGING_PREDECESSOR_VARIANTS_RETAINED=YES
PRODUCTION_PREDECESSOR_VARIANTS_ADDED=YES
```

## Decision

Wave 4 authority lock supersedes the transitional Phase 2D
`profiles.venue_id` + venue-role fallback for Tenant operational entitlement.

The following is **not** valid Tenant operational authority:

- `profiles.venue_id` + `profiles.role IN (VENUE_OWNER, COURT_OWNER, TENANT_OWNER)`

Interpretations:

| Signal | Meaning |
|---|---|
| `profiles.tenant_id` | context hint only |
| `profiles.venue_id` | home/default Venue context only |
| `tenant_members` (active) | Tenant operational entitlement authority |

Therefore Wave5 **target** `phase42_can_transfer_president` must **not** re-introduce
the profiles Venue-role fallback. Canonical target authz paths remain:

1. `phase42_is_platform_super_admin()`
2. `phase42_has_gov_role(club_owner|president)`
3. `tenant_members.tenant_owner` + `user_has_permission('club.update')` on non-deleted club

```
RPC01_TARGET_DELTA_CLASS=INTENTIONAL_LEGACY_AUTHORIZATION_PATH_RETIREMENT
RPC01_TARGET_MD5=61dd0458b9240d5407394f6f8d492bf0
RPC01_TARGET_MD5_UNCHANGED=YES
PROFILES_VENUE_ID_MAY_GRANT_TENANT_OPERATIONAL_AUTHORITY=NO
VENUE_ROLE_FALLBACK_MAY_GRANT_TRANSFER_PRESIDENT=NO
```

## Predecessor variant sets (exact hashes only)

Runtime APPLY accepts **only** the listed exact `md5(convert_to(prosrc,'UTF8'))`
values. No environment-name branch. No dynamic live approval. Unknown hash ⇒ abort.

### `public.phase42_can_transfer_president(text)`

| MD5 | Classification |
|---|---|
| `24f9f7e47c2dc0a166c6385811f6c43d` | CERTIFIED_HISTORICAL_SOURCE_MATCH_CRLF |
| `14b3e8e88cc83b1824e3631d718b89e5` | CERTIFIED_DEPLOYMENT_ARTIFACT_EQUIVALENT_LF |

Target (unchanged): `61dd0458b9240d5407394f6f8d492bf0`

### `public.club_review_membership_request(uuid,uuid,text,text,integer)`

| MD5 | Classification |
|---|---|
| `0b8ee11ef23090f8cd6e364ad2e6eb60` | CERTIFIED_HISTORICAL_SOURCE_MATCH |
| `cd904d71c508e9ee1e4768396c515ab0` | OWNER_ACCEPTED_SEMANTICALLY_EQUIVALENT_PREDECESSOR |

Certified delta for Production variant: `declare v_resp jsonb` vs `declare v_resp json`.

Target (unchanged): `2ef9e0d87071bba93814ab20344539c1`

## Related security package

Club table `TRUNCATE` for `anon` / `authenticated` is remediated in:

`docs/platform-core-wave5-club-context-closure/security-remediation/club-truncate-acl/`

That package does not change Club business writer semantics.
