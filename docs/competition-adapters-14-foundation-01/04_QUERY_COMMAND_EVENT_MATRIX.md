# 04 — QUERY / COMMAND / EVENT matrix

| Contract | Method | Kind | Direction | Default runtime |
| --- | --- | --- | --- | --- |
| 01 Identity | `resolveActorIdentity` | QUERY | inbound | BOUND |
| 01 Identity | `getAuthorizationEvidence` | QUERY | inbound | BOUND |
| 01 Identity | `getCapabilityEvidence` | QUERY | inbound | BOUND |
| 02 Tenant | `resolveTenantIdentity` | QUERY | inbound | PARTIAL |
| 02 Tenant | `validateScope` | QUERY | inbound | PARTIAL |
| 02 Tenant | `distinguishScopeIds` | QUERY | inbound | PARTIAL |
| 02 Tenant | `resolveOrganizationIdentity` | QUERY | inbound | NOT_CONFIGURED |
| 02 Tenant | `getOrganizationStatus` | QUERY | inbound | NOT_CONFIGURED |
| 03 Participant | `resolveCanonicalParticipant` | QUERY | inbound | BOUND |
| 03 Participant | `getCompetitionSafeProfile` | QUERY | inbound | BOUND |
| 03 Participant | `verifySourceStatus` | QUERY | inbound | BOUND |
| 03 Participant | `getParticipantSnapshot` | QUERY | inbound | BOUND |
| 04 Club/Team | `getClubAffiliation` | QUERY | inbound | BOUND |
| 04 Club/Team | `getMembershipStatus` | QUERY | inbound | BOUND |
| 04 Club/Team | `getMembershipEvidence` | QUERY | inbound | BOUND |
| 04 Club/Team | `getTeamIdentity` | QUERY | inbound | NOT_CONFIGURED |
| 04 Club/Team | `getTeamRoster` | QUERY | inbound | NOT_CONFIGURED |
| 04 Club/Team | `getCaptainRelationship` | QUERY | inbound | NOT_CONFIGURED |
| 05 Rating | `getRatingSnapshot` | QUERY | inbound | PARTIAL (requires injected resolver) |
| 06 Ranking | `getRankingSnapshot` | QUERY | inbound | NOT_CONFIGURED |
| 09 Finance | `getEntryFeeStatus` | QUERY | inbound | NOT_CONFIGURED |
| 09 Finance | `getPaymentState` | QUERY | inbound | NOT_CONFIGURED |
| 09 Finance | `getWaiverStatus` | QUERY | inbound | NOT_CONFIGURED |
| 09 Finance | `getRefundState` | QUERY | inbound | NOT_CONFIGURED |
| 09 Finance | `getSettlementReference` | QUERY | inbound | NOT_CONFIGURED |
| 10 Notification | `publishCompetitionCommunicationEvent` | EVENT | outbound | PARTIAL (`MATCH_SCHEDULED` only; requires `idempotencyKey`) |
| 11 File/Media | `getDocumentReference` | QUERY | inbound | NOT_CONFIGURED |
| 11 File/Media | `getMediaReference` | QUERY | inbound | NOT_CONFIGURED |
| 12 Streaming | `publishScoreboardProjection` | EVENT | outbound | NOT_CONFIGURED |
| 12 Streaming | `getStreamingMetadata` | QUERY | inbound | NOT_CONFIGURED |
| 13 Federation | `getFederationPlayerEvidence` | QUERY | inbound | NOT_CONFIGURED |
| 13 Federation | `getLicenseEvidence` | QUERY | inbound | NOT_CONFIGURED |
| 13 Federation | `getSanctionEvidence` | QUERY | inbound | NOT_CONFIGURED |
| 13 Federation | `getExternalEligibilityEvidence` | QUERY | inbound | NOT_CONFIGURED |
| 14 CRM/Sponsor | `getSponsorReference` | QUERY | inbound | NOT_CONFIGURED |
| 14 CRM/Sponsor | `getSponsorPackageReference` | QUERY | inbound | NOT_CONFIGURED |
| 15 Analytics | `publishCompetitionAnalyticsFact` | EVENT | outbound | NOT_CONFIGURED |
| 15 Analytics | `getNonAuthoritativeReport` | QUERY | inbound | NOT_CONFIGURED (non-authoritative if ever bound) |
| 16 Audit | `appendAuditRecord` | COMMAND | outbound | NOT_CONFIGURED |
| 16 Audit | `queryAuditEvidence` | QUERY | inbound | NOT_CONFIGURED |

No finance refund/create-intent COMMAND is declared. Those writes are not fabricated.

Rating post-competition publication is not declared. The authoritative rating domain does not expose a Competition-facing write in current CE wiring.
