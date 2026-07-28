# Staging live acceptance — expanded (pre-Staging remediation)

**Status:** Definitions only. **Not executed** until Staging rehearsal Owner GO + fresh backup.
**Related marker:** `PLATFORM_HARD_CUTOVER_01_PRE_STAGING_CAPABILITY_REMEDIATION_PR_READY`

## Acceptance cases

| ID | Domain | Pass criteria |
|----|--------|---------------|
| A-OWN | Owner login / RBAC / tenant | Owner JWT restores; SUPER_ADMIN intact; Owner venue/`tenant_members` unchanged vs pre-wipe snapshot |
| A-CLUB | Club canonical writer | Club create/list via club_* / `club_data_v3`; `club_ai_data` absent; no LS SoT under HC |
| A-COURT | Court durable runtime | Durable court-engine authority; local court store not Prod SoT |
| A-PLAYER | Player identity | Player rows without Auth invent; tenant isolation |
| A-RATE | Rating V5 idempotency | Same idempotency key → no duplicate verified write; club-blob rating write forbidden under HC |
| A-COMP | Competition finalized-result | Single writer `competition_ssot_finalize_match_result`; no direct `tournament_match_live` finalize |
| A-PAIR | Private Pairing A1–A7 | Matrix domain `private_pairing_rules`; no legacy_blob picker; no silent 3.5 under HC |
| A-COACH | Coaching durable | Mode DURABLE or UNAVAILABLE under HC — never LEGACY/LS SoT; reload persistence when durable |
| A-MSG | Messaging | Mode PRODUCTION or UNAVAILABLE under HC — never DEMO/mock; no silent success when backend down |
| A-DASH | Dashboard analytics | Canonical reporting projections or typed UNAVAILABLE; no mock invent; no LS metrics SoT; read-only |
| A-CAT | Public Catalog post-reseed | `public_catalog_list_*` returns seeded projections; no mock invent |
| A-G1..G6 | Six global HC criteria | See below |

## Six global hard-cutover criteria

| Code | Definition |
|------|------------|
| `ONE_CANONICAL_WRITER_PER_DOMAIN` | Matrix lists exactly one writer authority per domain |
| `NO_LEGACY_WRITER` | Legacy writers blocked by fail-closed policy under HC |
| `NO_LOCALSTORAGE_AUTHORITY` | LS is cache-only / forbidden as SoT under HC |
| `NO_MOCK_PERSISTENCE` | Mock/demo gateways forbidden under HC |
| `NO_SILENT_FALLBACK` | Missing backend → typed error/UNAVAILABLE, never silent invent |
| `NO_HYBRID_RUNTIME` | No dual active authorities for the same domain |

## Evidence location (future rehearsal)

`docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/`
