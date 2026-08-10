# 03 — Disposable Staging QA Identity Package

**Environment:** Staging only (`qyewbxjsiiyufanzcjcq`)  
**Production allowlist / batch / GO / snapshot:** FORBIDDEN  
**Retired B1/B1B Production GO/batch:** FORBIDDEN  
**Account creation in WP6A:** NOT PERFORMED (needs separate Owner provision GO)

## Package contents

| Artifact | Role |
|----------|------|
| `STAGING_QA_IDENTITY_DESIGNATION.json` | Canonical designation of 8 disposable identities |
| `STAGING_ALLOWLIST.template.json` | Allowlist shape + reserved placeholder UUIDs (not live authority) |
| `STAGING_RECOVERY_SNAPSHOT.template.json` | Recovery snapshot shape bound to Staging batch |
| `STAGING_PACKAGE_CHECKSUMS.json` | SHA-256 of designation + templates |
| `REAL_USER_EXCLUSION_PROOF.json` | Proof rules excluding real users / Production QA |

## Designated identities (8)

Labels: `STG-QA-04` … `STG-QA-11`  
Emails: `phase1c.stg.safe1@staging-qa.local` … `phase1c.stg.safe8@staging-qa.local`  
Domain proof: `@staging-qa.local` + local-part `phase1c.stg.*` (certified in `qaTestIdentityFilter.js`)

### Label contract (Option C — fail-closed)

| Environment | Exact labels | Interchangeable? |
|-------------|--------------|------------------|
| Production | `QA-04` … `QA-11` | **NO** — never reuse Staging labels |
| Staging rehearsal | `STG-QA-04` … `STG-QA-11` | **NO** — never reuse Production labels |

Cross-environment label reuse is **forbidden**. Package validation, SQL `qa_quarantine_prepare`, and the read-only preclaim validator share one exact-eight label/email predicate.

## One-time Staging batch UUID (reserved)

```text
c13c323a-4fec-4327-90ba-56128fb126f5
```

Never reuse Production batches:
- `b37186cf-e620-4f27-aba3-d7e8750ae7df`
- `9c9d5fc7-648e-44c6-a959-e62157f7c970`

## Tenant / venue scope

- Staging markers only (`venue-staging-*` class)
- No Production tenant binding
- Zero business reference counts required before rehearsal

## Rollback / recovery mapping

| Layer | Mapping |
|-------|---------|
| Identity bind | designation email/label → live auth/profile ids after Owner provision |
| Allowlist | outside-Git file hashed → `ALLOWLIST_SHA256` |
| Snapshot | outside-Git original-state file hashed → `SNAPSHOT_SHA256` |
| Batch | reserved UUID above (or Owner regenerates **new** UUID if this one is burned) |
| Auth restore | unban only if `auth_ban_state=applied` AND `original_auth_banned=false` |
| Schema | L1 rollback SQL 80/90 |

## Status

```text
STAGING_QA_PACKAGE_STATUS=DESIGNATED_CONTRACT_READY_PROVISION_PENDING_OWNER
STAGING_ALLOWLIST_STATUS=TEMPLATE_READY_LIVE_BIND_PENDING
STAGING_RECOVERY_SNAPSHOT_STATUS=TEMPLATE_READY_LIVE_BIND_PENDING
STAGING_CHECKSUM_STATUS=CONTRACT_CHECKSUMS_RECORDED
```

## Owner provision GO required (not WP6A)

1. Create exactly eight disposable Auth users on Staging with the designated emails
2. Ensure matching `public.profiles` rows (id = auth uid), `status` in {active,suspended,invited}, zero business refs
3. Export live allowlist + recovery snapshot **outside Git**
4. Compute SHA-256; do not commit PII/secrets
5. Issue Staging rehearsal Owner GO string (never Production confirmation string)
