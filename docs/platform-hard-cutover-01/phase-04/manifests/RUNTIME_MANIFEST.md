# Runtime Authority Manifest

Source of truth: `src/features/platform-hard-cutover/runtimeAuthorityMatrix.js`

**Domain count:** 26 (expanded in pre-Staging capability remediation).

| Domain | Canonical writer | Persistence | Fail-closed | Readiness |
|--------|------------------|-------------|-------------|-----------|
| identity_auth | Supabase Auth APIs | auth.users + profiles | IDENTITY_AUTH_UNAVAILABLE | PROTECTED_CANONICAL |
| rbac_catalog | identity admin RPCs | roles/permissions | RBAC_CATALOG_UNAVAILABLE | PROTECTED_CANONICAL |
| tenant_binding | tenant admin RPCs | venues + tenant_members | TENANT_BINDING_UNAVAILABLE | PROTECTED_CANONICAL |
| club_cloud | club_* RPC | club_data_v3 | CLUB_CLOUD_AUTHORITY_UNAVAILABLE | CANONICAL_WITH_RESEED |
| club_blob_local | forbidden as SoT under HC | cache-only | LOCALSTORAGE_AUTHORITY_FORBIDDEN | FAIL_CLOSED_UNDER_HC |
| club_governance | membership RPCs | club_members* | CLUB_GOVERNANCE_UNAVAILABLE | CANONICAL_WITH_RESEED |
| court_runtime | court-engine durable | court_engine_* | COURT_RUNTIME_* | ACTIVATION_REQUIRED |
| customer | customer RPC | customers* | CUSTOMER_AUTHORITY_UNAVAILABLE | STAGING_AHEAD |
| finance | finance RPC | finance_* | FINANCE_AUTHORITY_UNAVAILABLE | STAGING_AHEAD |
| crm | crm RPC | crm_* | CRM_AUTHORITY_UNAVAILABLE | STAGING_AHEAD |
| reporting | projection jobs/RPC | reporting_* | REPORTING_AUTHORITY_UNAVAILABLE | STAGING_AHEAD |
| coaching | durable adapter only under HC | coaching_* | COACHING_LOCALSTORAGE_AUTHORITY_FORBIDDEN | FAIL_CLOSED_UNTIL_DURABLE |
| vpr_ranking | vpr ledger RPC | vpr_* | VPR_AUTHORITY_UNAVAILABLE | ACTIVATION_REQUIRED |
| notifications | notification RPC | notifications* | NOTIFICATIONS_AUTHORITY_UNAVAILABLE | PARTIAL |
| competition_match_result | competition_ssot_finalize_match_result | competition_ssot_* | COMPETITION_SSOT_UNAVAILABLE | ACTIVATION_AFTER_M8 |
| team_tournament | TT command RPCs | team_tournament_* | TEAM_TOURNAMENT_AUTHORITY_UNAVAILABLE | STAGING_AHEAD_PARTIAL |
| referee | referee V5 RPC | referee + SSOT handoff | REFEREE_AUTHORITY_UNAVAILABLE | STAGING_AHEAD_PARTIAL |
| player_rating | rating V5 RPC | player_rating_* | PLAYER_RATING_DURABLE_UNAVAILABLE | ACTIVATION_REQUIRED |
| public_news | news admin RPC | news_* | PUBLIC_NEWS_LIVE_UNAVAILABLE | ACTIVATION_REQUIRED |
| public_catalog | catalog republish | public_catalog_* | PUBLIC_CATALOG_UNAVAILABLE | CANONICAL_WITH_RESEED |
| billing_subscription | billing RPCs | plans + subscriptions | BILLING_AUTHORITY_UNAVAILABLE | PROTECTED_CATALOG |
| marketplace | marketplace RPC | marketplace_* | MARKETPLACE_AUTHORITY_UNAVAILABLE | ACTIVATION_REQUIRED |
| messaging | trusted backend under HC | communication_* | MESSAGING_DEMO_AUTHORITY_FORBIDDEN | FAIL_CLOSED_UNTIL_ACTIVATION |
| ai_assistant | AI engine (flagged) | ai_suggestions* | AI_ASSISTANT_UNAVAILABLE | ACTIVATION_REQUIRED |
| dashboard_analytics | none (read-only) | reporting_* or UNAVAILABLE | DASHBOARD_ANALYTICS_MOCK_FORBIDDEN | FAIL_CLOSED_UNDER_HC |
| private_pairing_rules | PRIVATE_PAIRING_RPC.* | private_pairing_* | PRIVATE_PAIRING_LEGACY_PICKER_FORBIDDEN | CANONICAL_WITH_HC_GATES |

**Rule:** Never two authorities active for the same domain.

### private_pairing_rules authority (exact)

| Role | Authority |
|------|-----------|
| Rule SSOT | 4 tables: `private_pairing_rule_sets`, `private_pairing_rules`, `private_pairing_rule_targets`, `private_pairing_rule_audit_logs` |
| Writers | security-definer RPC only (`PRIVATE_PAIRING_RPC.*`) |
| Admin CRUD | SPA → `privatePairingRulesRepository` → RPC only |
| Live runtime rule load | `private_pairing_get_active_rules_for_scope` via `loadActiveRulesForLiveScope` |
| Admin player/club picker (hard cutover ON) | Canonical club/player repositories only |
| Admin player/club picker (hard cutover OFF) | Canonical when flags ON; else `legacy_blob` / `loadPlayersForClub` |
| Rating under hard cutover | No silent `3.5`; warn + exclude / fail-closed (`MISSING_PLAYER_RATING`, `INSUFFICIENT_RATED_PLAYERS`) |
