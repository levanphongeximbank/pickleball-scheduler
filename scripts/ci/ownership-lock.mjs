#!/usr/bin/env node
/**
 * Phase 44B.0 / 44B.0.1 — Ownership CI locks (CI only, no runtime dependency).
 *
 * Enforces canonical ownership boundaries for domains that are already FROZEN-LIVE
 * (Phase 44A). Two mechanisms, kept deliberately separate:
 *
 *   1. SCOPE_ALLOWLIST — explicit, permanent-ish scope exceptions for legitimate
 *      code (canonical gateways + server/serverless files under src/). Each entry is
 *      exact-file + exact-rule; NO wildcards. Edge Functions (supabase/functions/**)
 *      are NOT scanned by client rules at all (server realm), so they never need
 *      suppression.
 *
 *   2. BASELINE (scripts/ci/ownership-lock-baseline.json) — temporary DEBT only.
 *      The contract is per-(rule,file) OCCURRENCE COUNT + FINGERPRINT, so a NEW
 *      forbidden occurrence *inside an already-baselined file* is detected
 *      (count increase) and a changed occurrence is detected (fingerprint mismatch).
 *
 * Client rules scan `src/` only. Server realms are handled by scope, not baseline.
 *
 * Usage:
 *   node scripts/ci/ownership-lock.mjs          # check; exit 1 on new/changed violations
 *   node scripts/ci/ownership-lock.mjs --init   # (re)generate the debt baseline
 *   node scripts/ci/ownership-lock.mjs --report # print all current violations (no fail)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import path from "node:path";
import { API_ERROR_CODES } from "../../src/features/api/constants/apiErrors.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
// BASELINE_PATH is overridable via OWNERSHIP_LOCK_BASELINE (used for self-tests only;
// CI uses the default committed baseline).
const BASELINE_PATH = process.env.OWNERSHIP_LOCK_BASELINE
  ? path.resolve(ROOT, process.env.OWNERSHIP_LOCK_BASELINE)
  : path.join(ROOT, "scripts", "ci", "ownership-lock-baseline.json");
const REGISTERED_CODES = new Set(Object.values(API_ERROR_CODES));

// Client rules scan the app source tree only. supabase/functions/** (Deno Edge
// Functions) is a server realm and is intentionally NOT scanned here.
const SCAN_DIRS = ["src"];
const SCAN_EXT = new Set([".js", ".jsx", ".ts", ".tsx"]);
const IGNORE_DIRS = new Set(["node_modules", "dist", ".git", "coverage"]);

/**
 * Explicit scope allowlist for legitimate (non-debt) code. Exact file + exact rule.
 * `permanent: true` = structural (canonical gateway / server-only file), no removal phase.
 */
const SCOPE_ALLOWLIST = [
  {
    rule: "auth-supabase-client-boundary",
    file: "src/auth/supabaseClient.js",
    symbol: "createClient (@supabase/supabase-js)",
    reason: "Canonical Supabase client — the single approved place to construct a client.",
    permanent: true,
  },
  {
    rule: "auth-supabase-client-boundary",
    file: "src/features/api/repositories/supabaseApiKeyRepository.js",
    symbol: "createClient with SERVICE_ROLE",
    reason:
      "Serverless API key store (Phase 11D). Uses the non-public SERVICE_ROLE key; runs server-side only, never browser-bundled with a real key.",
    permanent: true,
  },
  {
    rule: "auth-supabase-client-boundary",
    file: "src/features/api/repositories/supabaseIntegrationAuditRepository.js",
    symbol: "createClient with SERVICE_ROLE",
    reason:
      "Serverless integration audit store (Phase 11E). Uses the non-public SERVICE_ROLE key; runs server-side only.",
    permanent: true,
  },
  {
    rule: "secret-service-role-in-client-boundary",
    file: "src/features/api/config/apiKeyStoreConfig.js",
    symbol: 'readEnv("SUPABASE_SERVICE_ROLE_KEY")',
    reason: "Server config resolver for the serverless API key store (server-only env read).",
    permanent: true,
  },
  {
    rule: "secret-service-role-in-client-boundary",
    file: "src/features/api/config/auditStoreConfig.js",
    symbol: 'readEnv("SUPABASE_SERVICE_ROLE_KEY")',
    reason: "Server config resolver for the serverless audit store (server-only env read).",
    permanent: true,
  },
];

function scopeAllowFor(ruleId) {
  return SCOPE_ALLOWLIST.filter((a) => a.rule === ruleId).map((a) => a.file);
}

/**
 * Each rule: { id, description, allow[], onlyIn?[], match(content) => string[] }
 * `match` returns the list of forbidden occurrences (used for count + fingerprint).
 */
const RULES = [
  {
    id: "auth-supabase-client-boundary",
    description:
      "createClient()/@supabase/supabase-js may only be used by approved gateways/server files.",
    match: (c) => [
      ...(c.match(/createClient\s*\(/g) || []),
      ...(c.match(/from\s+["']@supabase\/supabase-js["']/g) || []),
    ],
  },
  {
    id: "profile-direct-write-boundary",
    description: "Writes to public.profiles must go through the profile/identity gateway.",
    allow: ["src/auth/profileService.js", "src/features/identity/"],
    match: (c) =>
      c.match(/\.from\(\s*["']profiles["']\s*\)[\s\S]{0,240}?\.(insert|update|upsert|delete)\s*\(/g) || [],
  },
  {
    id: "venue-direct-write-boundary",
    description: "Writes to public.venues must go through the venue service gateway.",
    allow: ["src/domain/venueService.js"],
    match: (c) =>
      c.match(/\.from\(\s*["']venues["']\s*\)[\s\S]{0,240}?\.(insert|update|upsert|delete)\s*\(/g) || [],
  },
  {
    id: "billing-direct-write-boundary",
    description: "Billing table writes must go through the billing repository gateway.",
    allow: ["src/features/billing/repositories/"],
    match: (c) =>
      c.match(
        /\.from\(\s*["'](subscriptions|tenant_subscriptions|plans|plan_limits|invoices|invoice_items|payments|billing_events|billing_audit_logs)["']\s*\)[\s\S]{0,240}?\.(insert|update|upsert|delete)\s*\(/g
      ) || [],
  },
  {
    id: "secret-service-role-in-client-boundary",
    description:
      "Service-role secrets must not be READ in client bundle code (server/edge only). Name-only mentions in strings are allowed.",
    // Matches actual env reads/use, NOT string-literal mentions in messages or redaction lists.
    match: (c) =>
      c.match(
        /(?:readEnv\(\s*["'][A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*["']|(?:process\.env|import\.meta\.env)\s*\.\s*[A-Za-z0-9_]*SERVICE_ROLE[A-Za-z0-9_]*|(?:process\.env|import\.meta\.env)\s*\[\s*["'][A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*["']\s*\])/g
      ) || [],
  },
  {
    id: "reporting-read-only",
    description: "Analytics/reporting modules must remain read-only (no table mutations).",
    onlyIn: ["src/features/dashboard-analytics/"],
    match: (c) => c.match(/\.(insert|update|upsert|delete)\s*\(/g) || [],
  },
  {
    id: "authorization-legacy-club-registry",
    description:
      "Club-scope authorization / API guards must resolve scope via clubScopeResolver (canonical cloud registry), never loadClubs()/pickleball-clubs-v1.",
    // Scoped to the club-scope authorization decision surface (Phase 44C.1 cutover).
    // The single allowed reader of the local registry is src/auth/clubScopeResolver.js
    // (NOT listed here, so it is never scanned by this rule).
    onlyIn: [
      "src/auth/rbac.js",
      "src/auth/guardAction.js",
      "src/features/api/services/clubScopeService.js",
      "src/features/api/router/handlers/clubsHandler.js",
      "src/features/api/router/handlers/playersHandler.js",
      "src/features/api/router/handlers/courtsHandler.js",
    ],
    match: (c) => [
      ...(c.match(/\bloadClubs\s*\(/g) || []),
      ...(c.match(/pickleball-clubs-v1/g) || []),
    ],
  },
  {
    id: "authorization-raw-role-compare",
    description:
      "Club-scope authorization code must use rbac role helpers (rolesEqual/isXScopedRole/rbac.can*), not raw role-string comparisons.",
    onlyIn: [
      "src/auth/rbac.js",
      "src/auth/guardAction.js",
      "src/features/api/services/clubScopeService.js",
      "src/features/api/router/handlers/clubsHandler.js",
      "src/features/api/router/handlers/playersHandler.js",
      "src/features/api/router/handlers/courtsHandler.js",
    ],
    match: (c) => c.match(/\.role\s*(?:===|==|!==|!=)\s*["'][A-Za-z_]+["']/g) || [],
  },
  {
    id: "governance-legacy-registry-read",
    description:
      "Governance authorization paths must decide elevation via governanceScopeResolver (canonical club_governance_assignments / phase42_has_gov_role), never the local registry (getClubById/loadClubs/pickleball-clubs-v1).",
    // Scoped to the governance authorization surface (Phase 44C.1A cutover).
    // The single allowed reader of the local registry for governance is
    // src/auth/governanceScopeResolver.js (NOT listed here → never scanned).
    onlyIn: [
      "src/features/club/services/governanceRoleElevation.js",
      "src/auth/menuAccess.js",
    ],
    match: (c) => [
      ...(c.match(/\bgetClubById\s*\(/g) || []),
      ...(c.match(/\bloadClubs\s*\(/g) || []),
      ...(c.match(/pickleball-clubs-v1/g) || []),
    ],
  },
  {
    id: "governance-elevation-owner",
    description:
      "PLAYER→CLUB_MANAGER governance elevation logic may only be DEFINED in the canonical governanceScopeResolver; other modules must import it, not reimplement it.",
    allow: ["src/auth/governanceScopeResolver.js"],
    match: (c) =>
      c.match(/function\s+(?:resolveGovernanceElevatedRole|hasClubGovernanceManagerAccess)\b/g) || [],
  },
  {
    id: "club-entity-registry-read-in-ui",
    description:
      "Club-entity registry list/get reads in the UI/context layer must go through canonicalClubRepository (Phase 45A.1 read cutover): no loadClubs()/pickleball-clubs-v1/direct club-registry RPC bypass.",
    // Scoped to the app UI/consumer surface. The canonical read gateway
    // (src/features/club/repositories/) and the offline authz resolver
    // (src/auth/clubScopeResolver.js) are NOT in these dirs → never scanned.
    onlyIn: ["src/context/", "src/pages/", "src/components/"],
    match: (c) => [
      ...(c.match(/\bloadClubs\s*\(/g) || []),
      ...(c.match(/pickleball-clubs-v1/g) || []),
      ...(c.match(/\brpcV2ClubListRegistry\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubGet\s*\(/g) || []),
    ],
  },
  {
    id: "membership-roster-read-in-ui",
    description:
      "Club member ROSTER reads in the UI/context layer must go through canonicalMembershipRepository (Phase 45A.2 read cutover): no direct rpcV2ClubListMembers, no getClubMembers/blob roster, no clubExtension roster read, no direct .from(\"club_members\") select.",
    // Scoped to the app UI/consumer surface (same surface as the club-entity read lock).
    // The canonical read gateway (src/features/club/repositories/), the V2 RPC gateway
    // (src/features/club/services/) and the offline/activity/tournament services are NOT in
    // these dirs → never scanned. Command paths (add/remove/role/status) belong to 45A.4.
    onlyIn: ["src/context/", "src/pages/", "src/components/"],
    match: (c) => [
      ...(c.match(/\brpcV2ClubListMembers\s*\(/g) || []),
      ...(c.match(/\bgetClubMembers\s*\(/g) || []),
      ...(c.match(/\bloadClubExtension\s*\(/g) || []),
      ...(c.match(/\.from\(\s*["']club_members["']\s*\)/g) || []),
    ],
  },
  {
    id: "club-entity-command-domain-in-ui",
    description:
      "Club CREATE/RENAME/DELETE entity commands in UI/context must go through clubTenantService or clubOfflineCommandAdapter (Phase 45A.3E). Direct domain/clubService writer imports are blocked.",
    onlyIn: ["src/context/", "src/pages/", "src/components/"],
    match: (c) => {
      // Match imports of createClub/renameClub/deleteClub from domain/clubService specifically.
      const out = [];
      const importRe =
        /import\s*\{([^}]*)\}\s*from\s*["'][^"']*domain\/clubService\.js["']/g;
      let m;
      while ((m = importRe.exec(c)) !== null) {
        const names = m[1];
        if (/\bcreateClub\b/.test(names)) out.push("createClub from domain/clubService");
        if (/\brenameClub\b/.test(names)) out.push("renameClub from domain/clubService");
        if (/\bdeleteClub\b/.test(names)) out.push("deleteClub from domain/clubService");
        if (/\bupdateClubMeta\b/.test(names)) out.push("updateClubMeta from domain/clubService");
      }
      return out;
    },
  },
  {
    id: "club-entity-command-rpc-bypass-in-ui",
    description:
      "UI/context must not call club_create/club_update or rpcV2ClubCreate/rpcV2ClubUpdate directly — go through clubTenantService.",
    onlyIn: ["src/context/", "src/pages/", "src/components/"],
    match: (c) => [
      ...(c.match(/\brpcV2ClubCreate\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubUpdate\s*\(/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_create["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_update["']/g) || []),
    ],
  },
  {
    id: "club-entity-direct-table-write",
    description:
      "Direct public.clubs mutations must go through clubStorageV2RpcService (SECURITY DEFINER RPCs).",
    allow: ["src/features/club/services/clubStorageV2RpcService.js"],
    match: (c) =>
      c.match(
        /\.from\(\s*["']clubs["']\s*\)[\s\S]{0,240}?\.(insert|update|upsert|delete)\s*\(/g
      ) || [],
  },
  {
    id: "club-entity-legacy-dual-write-in-ui",
    description:
      "UI/context must not dual-write Club entities via persistClubToCloud / club_upsert_registry / syncClubsForVenueToCloud (legacy registry).",
    onlyIn: ["src/context/", "src/pages/", "src/components/"],
    match: (c) => [
      ...(c.match(/\bpersistClubToCloud\s*\(/g) || []),
      ...(c.match(/\brpcClubUpsertRegistry\s*\(/g) || []),
      ...(c.match(/\bsyncClubsForVenueToCloud\s*\(/g) || []),
    ],
  },
  {
    id: "club-entity-saveClubs-outside-offline",
    description:
      "saveClubs() Club registry writes must stay in the low-level data store, domain offline writers, V2-OFF rollback orchestrators, or explicit seed tools — never as a Production cloud command path.",
    allow: [
      "src/data/club.js",
      "src/domain/clubService.js",
      "src/features/club/services/clubTenantService.js",
      "src/features/club/services/clubRegistryCloudSync.js",
      "src/features/club/seed/",
      "src/features/tenant/seed/",
      "src/demo/seed/",
    ],
    match: (c) => c.match(/\bsaveClubs\s*\(/g) || [],
  },
  {
    id: "club-entity-legacy-upsert-surface",
    description:
      "club_upsert_registry / rpcClubUpsertRegistry may only be invoked from the legacy registry cloud service (hard-blocked under V2 at runtime).",
    allow: [
      "src/features/club/services/clubRegistryRpcService.js",
      "src/features/club/services/clubRegistryCloudService.js",
    ],
    match: (c) => [
      ...(c.match(/\brpcClubUpsertRegistry\s*\(/g) || []),
      ...(c.match(/["']club_upsert_registry["']/g) || []),
    ],
  },
  {
    id: "club-governance-table-direct-write",
    description:
      "Direct public.club_governance mutations are banned in client code (use approved RPCs when governance command cutover lands).",
    match: (c) =>
      c.match(
        /\.from\(\s*["']club_governance["']\s*\)[\s\S]{0,240}?\.(insert|update|upsert|delete)\s*\(/g
      ) || [],
  },
  {
    id: "club-entity-pickleball-clubs-key-mutate",
    description:
      "Direct localStorage mutation of pickleball-clubs-v1 must stay in src/data/club.js (or explicit seed scripts outside scanned allowlists).",
    allow: ["src/data/club.js", "src/features/club/seed/", "src/features/tenant/seed/", "src/demo/seed/"],
    match: (c) => c.match(/localStorage\.(setItem|removeItem)\s*\(\s*["']pickleball-clubs-v1["']/g) || [],
  },
  {
    id: "club-entity-rpc-transport-only",
    description:
      "Phase 45A.3F — club_create / club_update RPC invocations may only live in clubStorageV2RpcService (approved transport).",
    allow: ["src/features/club/services/clubStorageV2RpcService.js"],
    match: (c) => [
      ...(c.match(/callRpc\(\s*["']club_create["']/g) || []),
      ...(c.match(/callRpc\(\s*["']club_update["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_create["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_update["']/g) || []),
    ],
  },
  {
    id: "club-entity-rpcV2-orchestrator-only",
    description:
      "Phase 45A.3F — rpcV2ClubCreate / rpcV2ClubUpdate may only be invoked from clubTenantService (definitions allowed in transport).",
    allow: [
      "src/features/club/services/clubTenantService.js",
      "src/features/club/services/clubStorageV2RpcService.js",
    ],
    match: (c) => [
      ...(c.match(/\brpcV2ClubCreate\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubUpdate\s*\(/g) || []),
    ],
  },
  {
    id: "club-entity-legacy-persist-call-surface",
    description:
      "Phase 45A.3F — persistClubToCloud may only appear in legacy registry + V2-OFF orchestrators (hard-blocked under V2 at runtime).",
    allow: [
      "src/features/club/services/clubRegistryCloudService.js",
      "src/features/club/services/clubTenantService.js",
      "src/features/club/services/clubGovernanceService.js",
    ],
    match: (c) => c.match(/\bpersistClubToCloud\s*\(/g) || [],
  },
  {
    id: "club-entity-repository-readonly",
    description:
      "Phase 45A.3F — canonicalClubRepository must remain read-only; Club entity commands must not be added here.",
    onlyIn: ["src/features/club/repositories/canonicalClubRepository.js"],
    match: (c) => [
      ...(c.match(/\bsaveClubs\s*\(/g) || []),
      ...(c.match(/\bpersistClubToCloud\s*\(/g) || []),
      ...(c.match(/\bupdateClubMeta\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubCreate\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubUpdate\s*\(/g) || []),
      ...(c.match(/callRpc\(\s*["']club_(?:create|update)["']/g) || []),
      ...(c.match(
        /\.from\(\s*["']clubs["']\s*\)[\s\S]{0,240}?\.(insert|update|upsert|delete)\s*\(/g
      ) || []),
    ],
  },
  {
    id: "membership-request-command-rpc-bypass-in-ui",
    description:
      "Phase 45A.4B — UI/context must not call Membership request/leave RPCs or wrappers directly; go through clubMembershipRequestService.",
    onlyIn: ["src/context/", "src/pages/", "src/components/"],
    match: (c) => [
      ...(c.match(/\brpcV2ClubSubmitMembershipRequest\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubCancelMembershipRequest\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubReviewMembershipRequest\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubLeaveMembership\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubListMyRequests\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubListPendingRequests\s*\(/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_submit_membership_request["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_cancel_membership_request["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_review_membership_request["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_leave_membership["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_list_my_requests["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_list_pending_requests["']/g) || []),
      ...(c.match(/clubMembershipRequestRpcService/g) || []),
    ],
  },
  {
    id: "membership-request-rpc-transport-only",
    description:
      "Phase 45A.4B — Membership request/leave RPC callRpc/.rpc names may only live in clubStorageV2RpcService (V2 transport). Phase31 service is exempt for its own legacy definitions only.",
    allow: [
      "src/features/club/services/clubStorageV2RpcService.js",
      "src/features/club/services/clubMembershipRequestRpcService.js",
    ],
    match: (c) => [
      ...(c.match(/callRpc\(\s*["']club_submit_membership_request["']/g) || []),
      ...(c.match(/callRpc\(\s*["']club_cancel_membership_request["']/g) || []),
      ...(c.match(/callRpc\(\s*["']club_review_membership_request["']/g) || []),
      ...(c.match(/callRpc\(\s*["']club_leave_membership["']/g) || []),
      ...(c.match(/callRpc\(\s*["']club_list_my_requests["']/g) || []),
      ...(c.match(/callRpc\(\s*["']club_list_pending_requests["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_submit_membership_request["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_cancel_membership_request["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_review_membership_request["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_leave_membership["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_list_my_requests["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_list_pending_requests["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_leave_my_membership["']/g) || []),
    ],
  },
  {
    id: "membership-request-rpcV2-orchestrator-only",
    description:
      "Phase 45A.4B — rpcV2 Membership request/leave wrappers may only be invoked from clubMembershipRequestService (definitions allowed in transport).",
    allow: [
      "src/features/club/services/clubMembershipRequestService.js",
      "src/features/club/services/clubStorageV2RpcService.js",
    ],
    match: (c) => [
      ...(c.match(/\brpcV2ClubSubmitMembershipRequest\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubCancelMembershipRequest\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubReviewMembershipRequest\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubLeaveMembership\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubListMyRequests\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubListPendingRequests\s*\(/g) || []),
    ],
  },
  {
    id: "membership-request-phase31-ui-ban",
    description:
      "Phase 45A.4B — UI must not import Phase31 clubMembershipRequestRpcService; V2 Production uses SECURITY DEFINER V2 RPCs only.",
    onlyIn: ["src/context/", "src/pages/", "src/components/"],
    match: (c) => c.match(/clubMembershipRequestRpcService/g) || [],
  },
  {
    id: "membership-request-blob-write-in-ui",
    description:
      "Phase 45A.4B — UI must not write membership request blobs (saveClubExtension / membershipRequests mutation).",
    onlyIn: ["src/context/", "src/pages/", "src/components/"],
    match: (c) => [
      ...(c.match(/\bsaveMembershipRequests\s*\(/g) || []),
      ...(c.match(/\bsaveClubExtension\s*\(/g) || []),
    ],
  },
  {
    id: "membership-request-repository-readonly",
    description:
      "Phase 45A.4B — canonicalMembershipRepository remains read-only; Membership commands must not be added here.",
    onlyIn: ["src/features/club/repositories/canonicalMembershipRepository.js"],
    match: (c) => [
      ...(c.match(/\brpcV2ClubSubmitMembershipRequest\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubCancelMembershipRequest\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubReviewMembershipRequest\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubLeaveMembership\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubAddMember\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubRemoveMember\s*\(/g) || []),
      ...(c.match(/\baddMemberToClub\s*\(/g) || []),
      ...(c.match(/\bremoveMemberFromClub\s*\(/g) || []),
      ...(c.match(/\bsaveMembershipRequests\s*\(/g) || []),
      ...(c.match(/callRpc\(\s*["']club_(?:submit|cancel|review)_membership/g) || []),
      ...(c.match(/callRpc\(\s*["']club_(?:add|remove)_member["']/g) || []),
      ...(c.match(
        /\.from\(\s*["']club_members["']\s*\)[\s\S]{0,240}?\.(insert|update|upsert|delete)\s*\(/g
      ) || []),
      ...(c.match(
        /\.from\(\s*["']club_membership_requests_v42["']\s*\)[\s\S]{0,240}?\.(insert|update|upsert|delete)\s*\(/g
      ) || []),
    ],
  },
  {
    id: "member-command-rpc-bypass-in-ui",
    description:
      "Phase 45A.4C.4 — UI must not call add/remove member RPCs or wrappers directly; go through clubMemberService.",
    onlyIn: ["src/context/", "src/pages/", "src/components/"],
    match: (c) => [
      ...(c.match(/\brpcV2ClubAddMember\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubRemoveMember\s*\(/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_add_member["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_remove_member["']/g) || []),
      ...(c.match(/callRpc\(\s*["']club_add_member["']/g) || []),
      ...(c.match(/callRpc\(\s*["']club_remove_member["']/g) || []),
    ],
  },
  {
    id: "member-command-rpc-transport-only",
    description:
      "Phase 45A.4C.4 — club_add_member / club_remove_member callRpc/.rpc may only live in clubStorageV2RpcService.",
    allow: ["src/features/club/services/clubStorageV2RpcService.js"],
    match: (c) => [
      ...(c.match(/callRpc\(\s*["']club_add_member["']/g) || []),
      ...(c.match(/callRpc\(\s*["']club_remove_member["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_add_member["']/g) || []),
      ...(c.match(/\.rpc\(\s*["']club_remove_member["']/g) || []),
    ],
  },
  {
    id: "member-command-rpcV2-orchestrator-only",
    description:
      "Phase 45A.4C.4 — rpcV2ClubAddMember/RemoveMember may only be invoked from clubMemberService (definitions in transport).",
    allow: [
      "src/features/club/services/clubMemberService.js",
      "src/features/club/services/clubStorageV2RpcService.js",
    ],
    match: (c) => [
      ...(c.match(/\brpcV2ClubAddMember\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubRemoveMember\s*\(/g) || []),
    ],
  },
  {
    id: "member-blob-legacy-helpers-orchestrator-only",
    description:
      "Phase 45A.4C.5 — addMemberToClubLegacy / removeMemberFromClubLegacy may only exist in clubMemberService (offline adapter).",
    allow: ["src/features/club/services/clubMemberService.js"],
    match: (c) => [
      ...(c.match(/\baddMemberToClubLegacy\s*\(/g) || []),
      ...(c.match(/\bremoveMemberFromClubLegacy\s*\(/g) || []),
    ],
  },
  {
    id: "member-blob-ensure-player-offline-only",
    description:
      "Phase 45A.4C.5 — ensurePlayerInClubBlob is V2-OFF debt; must not leave clubMembershipRequestService or be imported by UI.",
    allow: ["src/features/club/services/clubMembershipRequestService.js"],
    match: (c) => c.match(/\bensurePlayerInClubBlob\s*\(/g) || [],
  },
  {
    id: "member-blob-add-remove-bypass-in-ui",
    description:
      "Phase 45A.4C.5 — UI must not call legacy blob membership writers or ensurePlayerInClubBlob; go through clubMemberService / membership request commands.",
    onlyIn: ["src/context/", "src/pages/", "src/components/"],
    match: (c) => [
      ...(c.match(/\baddMemberToClubLegacy\s*\(/g) || []),
      ...(c.match(/\bremoveMemberFromClubLegacy\s*\(/g) || []),
      ...(c.match(/\bensurePlayerInClubBlob\s*\(/g) || []),
      ...(c.match(/\bsaveClubExtension\s*\(/g) || []),
      ...(c.match(/\bsyncMembersFromBlob\s*\(/g) || []),
    ],
  },
  {
    id: "member-profiles-club-id-phase31-not-authority",
    description:
      "Phase 45A.4C.5 — Phase31 clubMembershipRequestRpcService must not be used as Membership authority under V2; keep allowlisted in request service for V2-OFF only.",
    onlyIn: ["src/context/", "src/pages/", "src/components/", "src/features/"],
    allow: [
      "src/features/club/services/clubMembershipRequestService.js",
      "src/features/club/services/clubMembershipRequestRpcService.js",
    ],
    match: (c) => [
      ...(c.match(/\brpcReviewClubMembershipRequest\s*\(/g) || []),
      ...(c.match(/\brpcLeaveMyClub\s*\(/g) || []),
      ...(c.match(/clubMembershipRequestRpcService/g) || []),
    ],
  },
  {
    id: "global-unregistered-error-code",
    description:
      "New string-literal error codes in the API layer must be registered in API_ERROR_CODES.",
    onlyIn: ["src/features/api/"],
    allow: ["src/features/api/constants/apiErrors.js", "src/features/api/constants/edgeApiErrors.js"],
    match: (c) => {
      const out = [];
      const re = /\bcode\s*(?::|===|==)\s*["']([A-Z][A-Z0-9_]{2,})["']/g;
      let m;
      while ((m = re.exec(c)) !== null) {
        if (!REGISTERED_CODES.has(m[1])) out.push(m[1]);
      }
      return out;
    },
  },
  {
    id: "team-tournament-setup-canonical-gateway",
    description:
      "P1.2 S1-A — Team Tournament setup semantic hashes/envelopes must go through canonical/teamTournamentCanonical.js (or repositories shim).",
    allow: [
      "src/features/team-tournament/canonical/",
      "src/features/team-tournament/repositories/teamTournamentCanonical.js",
      "src/features/team-tournament/repositories/teamTournamentIdempotency.js",
      "src/features/team-tournament/repositories/teamTournamentCompare.js",
      "src/features/team-tournament/setup/",
      "scripts/lib/team-tournament-shadow-compare-report.mjs",
    ],
    match: (c) => [
      ...(c.match(/\bhashCanonicalSetupSnapshot(?:Async)?\s*\(/g) || []),
      ...(c.match(/\bhashEngineInput(?:Async)?\s*\(/g) || []),
      ...(c.match(/\bhashEngineOutput(?:Async)?\s*\(/g) || []),
      ...(c.match(/\bbuildSetupMutationEnvelope(?:Async)?\s*\(/g) || []),
      ...(c.match(/\bvalidateSetupMutationEnvelope(?:Async)?\s*\(/g) || []),
      ...(c.match(/\bcalculateSetupMutationPayloadHash(?:Async)?\s*\(/g) || []),
    ],
  },
  {
    id: "team-tournament-node-crypto-boundary",
    description:
      "P1.2 S1-A — node:crypto under team-tournament is limited to canonical digest/legacy modules.",
    onlyIn: ["src/features/team-tournament/"],
    allow: [
      "src/features/team-tournament/canonical/teamTournamentCanonicalDigest.js",
      "src/features/team-tournament/canonical/teamTournamentCanonicalLegacy.js",
    ],
    match: (c) => c.match(/from\s+["']node:crypto["']/g) || [],
  },
  {
    id: "team-tournament-browser-async-hash",
    description:
      "P1.3 — browser-bundled modules must not call Node-only sync hash helpers; use Async SubtleCrypto variants.",
    onlyIn: [
      "src/features/team-tournament/ui/",
      "src/features/team-tournament/setup/executeSetupMutation.js",
      "src/features/team-tournament/repositories/cloudTeamTournamentRepository.js",
      "src/features/team-tournament/repositories/blobTeamTournamentRepository.js",
      "src/features/team-tournament/repositories/shadowTeamTournamentRepository.js",
      "src/pages/tournament/",
      "src/components/tournament/team/",
    ],
    match: (c) => [
      ...(c.match(/\bhashUtf8Sha256Sync\b/g) || []),
      ...(c.match(/\bhashCanonicalSetupSnapshot\s*\(/g) || []),
      ...(c.match(/\bhashEngineInput\s*\(/g) || []),
      ...(c.match(/\bhashEngineOutput\s*\(/g) || []),
      ...(c.match(/\bcalculateSetupMutationPayloadHash\s*\(/g) || []),
      ...(c.match(/\bbuildSetupMutationEnvelope\s*\(/g) || []),
      ...(c.match(/\bvalidateSetupMutationEnvelope\s*\(/g) || []),
      ...(c.match(/\bbuildSetupMutationPayload\s*\(/g) || []),
      ...(c.match(/\bbuildSetupMutationSnapshotPackage\s*\(/g) || []),
      ...(c.match(/\bpreviewSetupMutation\s*\(/g) || []),
    ],
  },
  {
    id: "team-tournament-hash-implementation-boundary",
    description:
      "P1.3 — SHA-256 for Team Tournament setup must only be implemented in canonical digest (no second browser hasher).",
    onlyIn: ["src/features/team-tournament/"],
    allow: [
      "src/features/team-tournament/canonical/teamTournamentCanonicalDigest.js",
      "src/features/team-tournament/canonical/teamTournamentCanonicalLegacy.js",
    ],
    match: (c) => [
      ...(c.match(/crypto\.subtle\.digest\s*\(/g) || []),
      ...(c.match(/createHash\s*\(\s*["']sha256["']\s*\)/gi) || []),
    ],
  },
];

function rel(abs) {
  return path.relative(ROOT, abs).split(path.sep).join("/");
}

function isAllowed(relPath, rule) {
  const allow = [...(rule.allow || []), ...scopeAllowFor(rule.id)];
  return allow.some((a) => relPath === a || relPath.startsWith(a));
}

function fingerprint(matches) {
  const norm = [...matches].sort();
  return createHash("sha256").update(JSON.stringify(norm)).digest("hex").slice(0, 16);
}

function walk(dirAbs, out) {
  let entries;
  try {
    entries = readdirSync(dirAbs);
  } catch {
    return;
  }
  for (const name of entries) {
    if (IGNORE_DIRS.has(name)) continue;
    const abs = path.join(dirAbs, name);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(abs, out);
    else if (SCAN_EXT.has(path.extname(name))) out.push(abs);
  }
}

/** Returns Map<`ruleId::file`, { rule, file, symbol, count, fingerprint }> */
function collectViolations() {
  const files = [];
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
  const found = new Map();
  for (const abs of files) {
    const relPath = rel(abs);
    let content;
    try {
      content = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    for (const rule of RULES) {
      if (rule.onlyIn && !rule.onlyIn.some((p) => relPath.startsWith(p))) continue;
      if (isAllowed(relPath, rule)) continue;
      const matches = rule.match(content);
      if (matches.length > 0) {
        found.set(`${rule.id}::${relPath}`, {
          rule: rule.id,
          file: relPath,
          symbol: [...new Set(matches)].join(" | "),
          count: matches.length,
          fingerprint: fingerprint(matches),
        });
      }
    }
  }
  return found;
}

function loadBaseline() {
  try {
    const data = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
    const map = new Map();
    for (const e of data.exceptions || []) map.set(`${e.rule}::${e.file}`, e);
    return map;
  } catch {
    return null;
  }
}

// Default reason/removal metadata for known temporary debt (used by --init).
const DEBT_META = {
  "auth-supabase-client-boundary::src/domain/matchLiveSync.js": {
    reason:
      "Realtime match-live sync constructs a dedicated no-persist ANON client instead of the canonical client; predates canonical realtime wiring.",
    removalPhase: "44B Realtime/Authorization cutover",
  },
  "club-entity-registry-read-in-ui::src/context/ClubContext.jsx": {
    reason:
      "Legacy blob-registry read path retained behind VITE_CANONICAL_CLUB_REPOSITORY_ENABLED=false for rollback / explicit offline mode. Canonical read gateway (canonicalClubRepository) is wired in Phase 45A.1 but not yet Production-authoritative (flag OFF).",
    removalPhase: "45A.5 blob/localStorage retirement",
  },
  "club-entity-registry-read-in-ui::src/pages/Players.jsx": {
    reason:
      "Player→club display mapping reads the club blob directly; migrate to the canonical club read after the ClubContext cutover is Production-verified.",
    removalPhase: "45A.5 blob/localStorage retirement",
  },
  "membership-roster-read-in-ui::src/pages/player/myClub/MyClubMembersPanel.jsx": {
    reason:
      "Explicit offline/no-Supabase legacy blob roster fallback, guarded by !canonicalMembershipRead. Canonical read (canonicalMembershipRepository) is authoritative whenever cloud membership is on (Club Storage V2 OR canonical repo flag); the blob is never the read authority in cloud mode.",
    removalPhase: "45A.5 blob/localStorage retirement",
  },
  "membership-roster-read-in-ui::src/pages/clubs/tabs/ClubMembersTab.jsx": {
    reason:
      "Explicit offline/no-Supabase legacy blob roster fallback, guarded by !canonicalMembershipRead. Canonical read is authoritative in cloud mode; blob mutations stay gated off until the Membership command cutover (45A.4).",
    removalPhase: "45A.5 blob/localStorage retirement",
  },
  "membership-roster-read-in-ui::src/pages/clubs/tabs/ClubOverviewTab.jsx": {
    reason:
      "Separate activity/rating display domain: member skill-level distribution reads the local roster for a histogram, not as the Membership read authority. Migrates with the Rating/Activity canonical cutover.",
    removalPhase: "Rating/Activity canonical cutover",
  },
  "membership-roster-read-in-ui::src/pages/clubs/tabs/ClubMatchHistoryTab.jsx": {
    reason:
      "Separate history/tournament domain: match-creation player dropdown reads the local roster, not as the Membership read authority. Migrates with the Tournament canonical cutover.",
    removalPhase: "Tournament canonical cutover",
  },
};

function runCli() {
  const mode = process.argv.includes("--init")
    ? "init"
    : process.argv.includes("--report")
      ? "report"
      : "check";

  const current = collectViolations();
  const sortedKeys = [...current.keys()].sort();

  if (mode === "init") {
    const exceptions = sortedKeys.map((k) => {
      const v = current.get(k);
      const meta = DEBT_META[k] || {};
      return {
        rule: v.rule,
        file: v.file,
        symbol: v.symbol,
        count: v.count,
        fingerprint: v.fingerprint,
        reason: meta.reason || "TODO: classify",
        removalPhase: meta.removalPhase || "unknown",
      };
    });
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        {
          note: "Phase 44B.0.1 baseline — TEMPORARY DEBT only. Lock fails on NEW files, count increases, or fingerprint changes. Legitimate server/gateway files live in SCOPE_ALLOWLIST inside ownership-lock.mjs, not here. No wildcards.",
          generatedAt: new Date().toISOString().slice(0, 10),
          rules: RULES.map((r) => ({ id: r.id, description: r.description })),
          exceptions,
        },
        null,
        2
      ) + "\n"
    );
    console.log(`ownership-lock: baseline written with ${exceptions.length} debt exception(s) → ${rel(BASELINE_PATH)}`);
    process.exit(0);
  }

  if (mode === "report") {
    console.log(`ownership-lock: ${sortedKeys.length} current violation(s)`);
    for (const k of sortedKeys) {
      const v = current.get(k);
      console.log(`  - ${k}  (count=${v.count}, fp=${v.fingerprint}, symbol=${v.symbol})`);
    }
    process.exit(0);
  }

  const baseline = loadBaseline();
  if (!baseline) {
    console.error("ownership-lock: FAIL — baseline missing. Run `node scripts/ci/ownership-lock.mjs --init`.");
    process.exit(1);
  }

  const failures = [];
  for (const k of sortedKeys) {
    const v = current.get(k);
    const base = baseline.get(k);
    if (!base) {
      failures.push(`NEW violation: ${k} (count=${v.count}, symbol=${v.symbol})`);
      continue;
    }
    if (v.count > base.count) {
      failures.push(`NEW occurrence in baselined file: ${k} (was ${base.count}, now ${v.count})`);
      continue;
    }
    if (v.count === base.count && v.fingerprint !== base.fingerprint) {
      failures.push(`CHANGED occurrence in baselined file: ${k} (fingerprint ${base.fingerprint} → ${v.fingerprint})`);
    }
  }

  const resolved = [...baseline.keys()].filter((k) => !current.has(k));

  if (failures.length > 0) {
    console.error(`ownership-lock: FAIL — ${failures.length} issue(s):`);
    for (const f of failures) console.error(`  + ${f}`);
    process.exit(1);
  }

  console.log(
    `ownership-lock: OK — 0 new/changed violation(s) (debt baseline: ${baseline.size}${resolved.length ? `, resolved: ${resolved.length}` : ""})`
  );
  process.exit(0);
}

// Only execute the CLI when run directly (not when imported by tests).
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const selfPath = fileURLToPath(import.meta.url);
if (invokedPath && selfPath === invokedPath) {
  runCli();
}

export { RULES, collectViolations };
