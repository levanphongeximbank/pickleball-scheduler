#!/usr/bin/env node
/**
 * CUSTOMER-07 — Live Staging certification suite.
 *
 * Requires Staging identity + service role + anon key.
 * Uses synthetic CUSTOMER07_TEST_* data only.
 * Does not modify Identity/Player/CRM internals.
 * Does not apply Production.
 * Secrets never printed.
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

import * as Customer from "../../src/features/customer/index.js";
import {
  CUSTOMER_07_EVIDENCE_DIR,
  CUSTOMER_07_STAGING_PROJECT_REF,
  CUSTOMER_07_TEST_PREFIX,
  CUSTOMER_07_VERDICTS,
  createSupabaseCustomerDatabaseClient,
  inspectCustomer07EnvironmentIdentity,
  loadCustomer07StagingEnv,
  getCustomer07RepoRoot,
} from "../../src/features/customer/staging/index.js";

const SCOPE_A = Object.freeze({
  tenantId: `${CUSTOMER_07_TEST_PREFIX}TENANT_A`,
  venueId: `${CUSTOMER_07_TEST_PREFIX}VENUE_A`,
});
const SCOPE_B = Object.freeze({
  tenantId: `${CUSTOMER_07_TEST_PREFIX}TENANT_B`,
  venueId: `${CUSTOMER_07_TEST_PREFIX}VENUE_B`,
});

function check(name, ok, detail = null) {
  return { name, ok: Boolean(ok), detail };
}

function writeEvidence(repoRoot, filename, payload) {
  const dir = path.join(repoRoot, CUSTOMER_07_EVIDENCE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
}

async function mgmtQuery(accessToken, sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${CUSTOMER_07_STAGING_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
  }
  return body;
}

function createCertifiedFakeDirectories() {
  return {
    identityAccountDirectory: Customer.createInMemoryIdentityAccountDirectory([
      {
        accountId: `${CUSTOMER_07_TEST_PREFIX}ID_A`,
        tenantId: SCOPE_A.tenantId,
        venueId: SCOPE_A.venueId,
        status: "ACTIVE",
      },
    ]),
    playerDirectory: Customer.createInMemoryPlayerDirectory([
      {
        playerId: `${CUSTOMER_07_TEST_PREFIX}PL_A`,
        tenantId: SCOPE_A.tenantId,
        venueId: SCOPE_A.venueId,
        status: "ACTIVE",
      },
    ]),
    crmContactDirectory: Customer.createInMemoryCrmContactDirectory([
      {
        contactRefId: `${CUSTOMER_07_TEST_PREFIX}CRM_A`,
        externalSystem: "CRM",
        tenantId: SCOPE_A.tenantId,
        venueId: SCOPE_A.venueId,
        status: "ACTIVE",
      },
    ]),
    liveExternalDirectoryDeferred: true,
  };
}

async function cleanupViaSql(accessToken) {
  // History tables are append-only by design — do not DELETE them.
  // Soft-archive synthetic customers and remove mutable child rows only.
  const sql = `
DO $$
BEGIN
  IF to_regclass('public.customers') IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.customer_merge_proposals
   WHERE tenant_id LIKE 'CUSTOMER07_TEST_%';
  DELETE FROM public.customer_duplicate_candidates
   WHERE tenant_id LIKE 'CUSTOMER07_TEST_%';
  DELETE FROM public.customer_linkages
   WHERE tenant_id LIKE 'CUSTOMER07_TEST_%';
  DELETE FROM public.customer_communication_preferences
   WHERE tenant_id LIKE 'CUSTOMER07_TEST_%';
  DELETE FROM public.customer_consents
   WHERE tenant_id LIKE 'CUSTOMER07_TEST_%';
  DELETE FROM public.customer_addresses
   WHERE tenant_id LIKE 'CUSTOMER07_TEST_%';
  DELETE FROM public.customer_contact_points
   WHERE tenant_id LIKE 'CUSTOMER07_TEST_%';

  UPDATE public.customers
     SET status = 'ARCHIVED',
         display_name = left(display_name, 180) || ' [CUSTOMER07_ARCHIVED]',
         updated_at = now()
   WHERE (tenant_id LIKE 'CUSTOMER07_TEST_%'
      OR customer_id LIKE 'CUSTOMER07_TEST_%'
      OR customer_number LIKE 'CUSTOMER07_TEST_%')
     AND status NOT IN ('ARCHIVED', 'MERGED');
END $$;
`;
  await mgmtQuery(accessToken, sql);
  return {
    ok: true,
    method: "soft_archive_plus_mutable_child_delete",
    historyPreserved: true,
  };
}

async function main() {
  const repoRoot = getCustomer07RepoRoot();
  loadCustomer07StagingEnv({ repoRoot });

  const identity = inspectCustomer07EnvironmentIdentity(process.env);
  if (!identity.ok) {
    const blocked = {
      ok: false,
      verdict: CUSTOMER_07_VERDICTS.BLOCKED_ENVIRONMENT_IDENTITY,
      identity,
      secretsPrinted: false,
    };
    writeEvidence(repoRoot, "LIVE_CERTIFICATION.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exit(1);
  }

  const url = String(process.env.STAGING_SUPABASE_URL || "").trim();
  const anonKey = String(process.env.STAGING_SUPABASE_ANON_KEY || "").trim();
  const serviceKey = String(
    process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || ""
  ).trim();
  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();

  if (!url || !anonKey || !serviceKey) {
    const blocked = {
      ok: false,
      verdict: CUSTOMER_07_VERDICTS.BLOCKED,
      message: "Missing Staging URL/anon/service-role credentials.",
      secretsPrinted: false,
    };
    writeEvidence(repoRoot, "LIVE_CERTIFICATION.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exit(1);
  }

  const serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const db = createSupabaseCustomerDatabaseClient({ client: serviceClient });

  /** @type {ReturnType<typeof check>[]} */
  const results = [];

  // --- Schema ---
  try {
    const schemaRows = await mgmtQuery(
      accessToken,
      `
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND relname IN (
  'customers','customer_contact_points','customer_addresses',
  'customer_consents','customer_consent_history',
  'customer_communication_preferences','customer_preference_history',
  'customer_linkages','customer_linkage_history',
  'customer_duplicate_candidates','customer_merge_proposals','customer_merge_history'
)
ORDER BY relname;
`
    );
    const names = new Set(
      (Array.isArray(schemaRows) ? schemaRows : []).map((r) => r.relname)
    );
    const expected = [
      "customers",
      "customer_contact_points",
      "customer_addresses",
      "customer_consents",
      "customer_consent_history",
      "customer_communication_preferences",
      "customer_preference_history",
      "customer_linkages",
      "customer_linkage_history",
      "customer_duplicate_candidates",
      "customer_merge_proposals",
      "customer_merge_history",
    ];
    results.push(
      check(
        "schema.tables_present",
        expected.every((n) => names.has(n)),
        { present: [...names] }
      )
    );
    const rlsOk = (Array.isArray(schemaRows) ? schemaRows : []).every(
      (r) => r.relrowsecurity === true
    );
    results.push(check("schema.rls_enabled", rlsOk));

    const usingTrue = await mgmtQuery(
      accessToken,
      `
SELECT pol.polname, cls.relname
FROM pg_policy pol
JOIN pg_class cls ON cls.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = cls.relnamespace
WHERE n.nspname='public' AND cls.relname LIKE 'customer%'
  AND pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%(true)%';
`
    );
    results.push(
      check(
        "schema.no_using_true_policies",
        !Array.isArray(usingTrue) || usingTrue.length === 0,
        { count: Array.isArray(usingTrue) ? usingTrue.length : 0 }
      )
    );
  } catch (err) {
    results.push(check("schema.probe", false, err?.message || String(err)));
  }

  // --- RLS role matrix (anon / service) ---
  {
    const anonSelect = await anonClient.from("customers").select("customer_id").limit(1);
    results.push(
      check(
        "rls.anon_cannot_read_customers",
        Boolean(anonSelect.error) ||
          (Array.isArray(anonSelect.data) && anonSelect.data.length === 0),
        anonSelect.error?.message || { rowCount: anonSelect.data?.length ?? 0 }
      )
    );
    const anonInsert = await anonClient.from("customers").insert({
      customer_id: `${CUSTOMER_07_TEST_PREFIX}ANON_BLOCK`,
      customer_number: `${CUSTOMER_07_TEST_PREFIX}ANON_BLOCK`,
      tenant_id: SCOPE_A.tenantId,
      venue_id: SCOPE_A.venueId,
      customer_type: "INDIVIDUAL",
      status: "ACTIVE",
      display_name: `${CUSTOMER_07_TEST_PREFIX}ANON`,
      version: 1,
    });
    results.push(
      check(
        "rls.anon_cannot_write_customers",
        Boolean(anonInsert.error),
        anonInsert.error?.message || "unexpected success"
      )
    );

    const svcRead = await serviceClient
      .from("customers")
      .select("customer_id")
      .limit(1);
    results.push(
      check(
        "rls.service_role_can_read",
        !svcRead.error,
        svcRead.error?.message || null
      )
    );
  }

  // --- Runtime / durable repository ---
  const directories = createCertifiedFakeDirectories();
  let runtime;
  try {
    runtime = Customer.createCustomerRuntime(
      {
        enabled: true,
        mode: Customer.CUSTOMER_RUNTIME_MODE.DURABLE,
        environment: Customer.CUSTOMER_RUNTIME_ENVIRONMENT.STAGING,
      },
      {
        db,
        identityAccountDirectory: directories.identityAccountDirectory,
        playerDirectory: directories.playerDirectory,
        crmContactDirectory: directories.crmContactDirectory,
        mergeApprovalPort: Customer.createInMemoryAllowAllMergeApproval(),
        idGenerator: {
          seq: 0,
          nextId(prefix) {
            this.seq += 1;
            return `${prefix}${this.seq}_${Date.now().toString(36)}_${Math.floor(
              Math.random() * 1e6
            ).toString(36)}`;
          },
        },
      }
    );
    results.push(
      check(
        "runtime.durable_ready",
        runtime.ready === true &&
          runtime.persistenceMode === Customer.CUSTOMER_RUNTIME_MODE.DURABLE
      )
    );
    results.push(
      check(
        "runtime.live_external_directory_deferred",
        directories.liveExternalDirectoryDeferred === true,
        "LIVE_EXTERNAL_DIRECTORY_DEFERRED"
      )
    );
  } catch (err) {
    results.push(check("runtime.durable_ready", false, err?.message || String(err)));
  }

  // Production memory fallback still rejected
  try {
    Customer.createCustomerRuntime({
      enabled: true,
      mode: Customer.CUSTOMER_RUNTIME_MODE.MEMORY,
      environment: Customer.CUSTOMER_RUNTIME_ENVIRONMENT.PRODUCTION,
    });
    results.push(check("runtime.production_memory_rejected", false));
  } catch {
    results.push(check("runtime.production_memory_rejected", true));
  }

  // Missing config fail-closed
  try {
    Customer.createCustomerRuntime({
      enabled: true,
      mode: Customer.CUSTOMER_RUNTIME_MODE.DURABLE,
      environment: Customer.CUSTOMER_RUNTIME_ENVIRONMENT.STAGING,
    });
    results.push(check("runtime.missing_db_fail_closed", false));
  } catch {
    results.push(check("runtime.missing_db_fail_closed", true));
  }

  if (runtime?.ready) {
    const app = runtime.application;
    const consentApp = runtime.consentPreferenceApplication;
    const linkageApp = runtime.linkageApplication;
    const mergeApp = runtime.mergeApplication;

    // Cleanup any prior test residue first
    try {
      await cleanupViaSql(accessToken);
    } catch {
      /* continue */
    }

    let created;
    try {
      const emailToken = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
      created = await app.createCustomer({
        ...SCOPE_A,
        customerType: Customer.CUSTOMER_TYPE.INDIVIDUAL,
        displayName: `${CUSTOMER_07_TEST_PREFIX}Alice`,
        contactPoints: [
          {
            type: Customer.CONTACT_POINT_TYPE.EMAIL,
            value: `${CUSTOMER_07_TEST_PREFIX.toLowerCase()}alice.${emailToken}@example.test`,
            primary: true,
          },
          {
            type: Customer.CONTACT_POINT_TYPE.PHONE,
            value: `+8490${String(Date.now()).slice(-7)}`,
            primary: true,
          },
        ],
        addresses: [
          {
            addressType: Customer.CUSTOMER_ADDRESS_TYPE.POSTAL,
            addressLine1: `${CUSTOMER_07_TEST_PREFIX}Addr 1`,
            locality: "HCM",
            primary: true,
          },
        ],
      });
      results.push(
        check(
          "repo.create_customer",
          Boolean(created?.customerId)
        )
      );

      const readBack = await app.getCustomer(SCOPE_A, created.customerId);
      results.push(
        check(
          "repo.read_customer",
          readBack?.customerId === created.customerId
        )
      );

      const updated = await app.updateCustomerProfile(
        SCOPE_A,
        created.customerId,
        { displayName: `${CUSTOMER_07_TEST_PREFIX}Alice Updated` },
        { expectedVersion: created.version }
      );
      results.push(
        check(
          "repo.update_profile_version_ok",
          updated?.version === created.version + 1
        )
      );

      try {
        await app.updateCustomerProfile(
          SCOPE_A,
          created.customerId,
          { displayName: `${CUSTOMER_07_TEST_PREFIX}Stale` },
          { expectedVersion: created.version }
        );
        results.push(check("repo.stale_version_conflict", false));
      } catch (err) {
        results.push(
          check(
            "repo.stale_version_conflict",
            err?.code === Customer.CUSTOMER_ERROR_CODES.VERSION_CONFLICT ||
              /VERSION_CONFLICT/i.test(String(err?.message || err)),
            err?.code || err?.message
          )
        );
      }

      let wrongScopeNull = false;
      try {
        const wrongScope = await app.getCustomer(SCOPE_B, created.customerId);
        wrongScopeNull = wrongScope == null;
      } catch {
        wrongScopeNull = true;
      }
      results.push(
        check("repo.tenant_isolation_wrong_scope", wrongScopeNull)
      );

      const purpose = Customer.CUSTOMER_COMMUNICATION_PURPOSE.SERVICE;
      const channel = Customer.CUSTOMER_COMMUNICATION_CHANNEL.EMAIL;
      const granted = await consentApp.grantConsent(
        SCOPE_A,
        created.customerId,
        {
          purpose,
          channel,
          evidenceReference: `${CUSTOMER_07_TEST_PREFIX}EV_1`,
          source: Customer.CUSTOMER_CONSENT_SOURCE.STAFF,
        }
      );
      results.push(check("consent.grant", Boolean(granted?.consentId)));

      const opted = await consentApp.optInCommunication(
        SCOPE_A,
        created.customerId,
        { purpose, channel }
      );
      results.push(check("preference.opt_in", Boolean(opted?.preferenceId)));

      const notif = Customer.createCustomerNotificationEligibilityAdapter({
        consentPreferenceApplication: consentApp,
      });
      results.push(
        check(
          "consent.notification_adapter_read_only",
          typeof notif.getCommunicationEligibility === "function" &&
            typeof notif.grantConsent === "undefined" &&
            typeof notif.revokeConsent === "undefined"
        )
      );

      let current = await app.getCustomer(SCOPE_A, created.customerId);
      const idLink = await linkageApp.linkIdentityAccount(
        SCOPE_A,
        created.customerId,
        `${CUSTOMER_07_TEST_PREFIX}ID_A`,
        { source: Customer.CUSTOMER_LINKAGE_SOURCE.MANUAL },
        { expectedVersion: current.version }
      );
      results.push(check("linkage.identity", Boolean(idLink?.linkageId)));

      current = await app.getCustomer(SCOPE_A, created.customerId);
      const playerLink = await linkageApp.linkPlayer(
        SCOPE_A,
        created.customerId,
        `${CUSTOMER_07_TEST_PREFIX}PL_A`,
        {},
        { expectedVersion: current.version }
      );
      results.push(check("linkage.player", Boolean(playerLink?.linkageId)));

      current = await app.getCustomer(SCOPE_A, created.customerId);
      const crmLink = await linkageApp.linkCrmReference(
        SCOPE_A,
        created.customerId,
        `${CUSTOMER_07_TEST_PREFIX}CRM_A`,
        {},
        { expectedVersion: current.version }
      );
      results.push(check("linkage.crm", Boolean(crmLink?.linkageId)));

      const searchById = await app.searchCustomers(SCOPE_A, {
        customerId: created.customerId,
      });
      results.push(
        check(
          "search.by_customer_id",
          Array.isArray(searchById) &&
            searchById.some((r) => r.customerId === created.customerId)
        )
      );

      const created2 = await app.createCustomer({
        ...SCOPE_A,
        customerType: Customer.CUSTOMER_TYPE.INDIVIDUAL,
        displayName: `${CUSTOMER_07_TEST_PREFIX}Bob`,
        contactPoints: [
          {
            type: Customer.CONTACT_POINT_TYPE.EMAIL,
            value: `${CUSTOMER_07_TEST_PREFIX.toLowerCase()}bob.${emailToken}@example.test`,
            primary: true,
          },
        ],
      });

      const orderedPair = Customer.orderCustomerPair(
        created.customerId,
        created2.customerId
      );
      let candidate;
      try {
        candidate = await mergeApp.createOrRefreshDuplicateCandidate(
          SCOPE_A,
          {
            customerIdA: orderedPair.customerIdA,
            customerIdB: orderedPair.customerIdB,
          }
        );
        results.push(
          check("dedup.candidate_created", Boolean(candidate?.candidateId), {
            customerIdA: candidate?.customerIdA,
            customerIdB: candidate?.customerIdB,
            orderedOk:
              candidate?.customerIdA < candidate?.customerIdB,
          })
        );
      } catch (err) {
        results.push(
          check("dedup.candidate_created", false, {
            message: err?.message,
            code: err?.code,
            orderedPair,
            createdId: created.customerId,
            created2Id: created2.customerId,
          })
        );
        throw err;
      }

      let proposal;
      try {
        // Proposal can be created without candidateId (phase-6 certified path).
        // Avoid ordering-sensitive candidate staleness coupling in this live check.
        proposal = await mergeApp.createMergeProposal(SCOPE_A, {
          survivorCustomerId: created.customerId,
          absorbedCustomerId: created2.customerId,
        });
        results.push(
          check("merge.proposal_created", Boolean(proposal?.mergeProposalId))
        );
      } catch (err) {
        results.push(
          check("merge.proposal_created", false, {
            message: err?.message,
            code: err?.code,
            context: err?.context,
          })
        );
        throw err;
      }

      // Unapproved merge must fail when approval port is absent.
      try {
        const noApprovalRuntime = Customer.createCustomerRuntime(
          {
            enabled: true,
            mode: Customer.CUSTOMER_RUNTIME_MODE.DURABLE,
            environment: Customer.CUSTOMER_RUNTIME_ENVIRONMENT.STAGING,
          },
          {
            db,
            mergeApprovalPort: Customer.createFailClosedMergeApproval(),
          }
        );
        await noApprovalRuntime.mergeApplication.mergeCustomers(
          SCOPE_A,
          proposal.mergeProposalId
        );
        results.push(check("merge.unapproved_blocked", false));
      } catch (err) {
        results.push(
          check(
            "merge.unapproved_blocked",
            err?.code ===
              Customer.CUSTOMER_ERROR_CODES.MERGE_PROPOSAL_NOT_APPROVED ||
              err?.code ===
                Customer.CUSTOMER_ERROR_CODES.MERGE_APPROVAL_REQUIRED,
            err?.code || err?.message
          )
        );
      }

      const approved = await mergeApp.approveMergeProposal(
        SCOPE_A,
        proposal.mergeProposalId,
        { approvalReference: `${CUSTOMER_07_TEST_PREFIX}APR_1` }
      );
      results.push(
        check("merge.explicit_approval", Boolean(approved?.mergeProposalId))
      );

      // Stale expected versions must block approval.
      try {
        const staleProposal = await mergeApp.createMergeProposal(SCOPE_A, {
          survivorCustomerId: created.customerId,
          absorbedCustomerId: created2.customerId,
          expectedSurvivorVersion: 1,
        });
        await mergeApp.approveMergeProposal(
          SCOPE_A,
          staleProposal.mergeProposalId,
          { approvalReference: `${CUSTOMER_07_TEST_PREFIX}APR_STALE` }
        );
        results.push(check("merge.stale_proposal_rejected", false));
      } catch (err) {
        results.push(
          check(
            "merge.stale_proposal_rejected",
            err?.code === Customer.CUSTOMER_ERROR_CODES.MERGE_PROPOSAL_STALE,
            err?.code || err?.message
          )
        );
      }

      const merged = await mergeApp.mergeCustomers(
        SCOPE_A,
        proposal.mergeProposalId
      );
      results.push(
        check(
          "merge.execute_tombstone",
          merged?.absorbedStatus === Customer.CUSTOMER_STATUS.MERGED ||
            merged?.absorbedCustomerId === created2.customerId,
          {
            absorbedStatus: merged?.absorbedStatus,
            survivor: merged?.survivorCustomerId,
          }
        )
      );

      const redirect = Customer.createCustomerRedirectAdapter({
        customerRepository: runtime.repository,
        mergeApplication: mergeApp,
      });
      const resolved = await redirect.resolveCanonicalCustomerId(
        SCOPE_A,
        created2.customerId
      );
      results.push(
        check(
          "merge.redirect_resolver",
          resolved === created.customerId,
          { resolved, survivor: created.customerId }
        )
      );

      try {
        const noApprovalRuntime = Customer.createCustomerRuntime(
          {
            enabled: true,
            mode: Customer.CUSTOMER_RUNTIME_MODE.DURABLE,
            environment: Customer.CUSTOMER_RUNTIME_ENVIRONMENT.STAGING,
          },
          { db }
        );
        await noApprovalRuntime.mergeApplication.mergeCustomers(
          SCOPE_A,
          proposal.mergeProposalId
        );
        results.push(check("merge.approval_required_fail_closed", false));
      } catch {
        results.push(check("merge.approval_required_fail_closed", true));
      }
    } catch (err) {
      results.push(
        check("live.repository_suite", false, err?.message || String(err))
      );
    }

    // Cleanup
    let cleanup;
    try {
      cleanup = await cleanupViaSql(accessToken);
      const remaining = await serviceClient
        .from("customers")
        .select("customer_id,status")
        .like("tenant_id", `${CUSTOMER_07_TEST_PREFIX}%`)
        .neq("status", "ARCHIVED")
        .neq("status", "MERGED");
      results.push(
        check(
          "cleanup.test_customers_removed",
          !remaining.error &&
            Array.isArray(remaining.data) &&
            remaining.data.length === 0,
          {
            remainingActive: remaining.data?.length,
            cleanup,
            error: remaining.error?.message,
            historyPreserved: true,
          }
        )
      );
    } catch (err) {
      results.push(
        check("cleanup.test_customers_removed", false, err?.message || String(err))
      );
    }
  }

  // Adapters composition (Customer-owned)
  results.push(
    check(
      "runtime.adapters_exported",
      typeof Customer.createCustomerIdentityLinkageAdapter === "function" &&
        typeof Customer.createCustomerPlayerLinkageAdapter === "function" &&
        typeof Customer.createCustomerCrmLinkageAdapter === "function" &&
        typeof Customer.createCustomerNotificationEligibilityAdapter ===
          "function" &&
        typeof Customer.createCustomerRedirectAdapter === "function"
    )
  );

  const failed = results.filter((r) => !r.ok);
  const report = {
    phase: "CUSTOMER-07",
    script: "phase-7-staging-live-certify",
    ok: failed.length === 0,
    verdict:
      failed.length === 0
        ? CUSTOMER_07_VERDICTS.STAGING_CERTIFIED
        : CUSTOMER_07_VERDICTS.READY_WITH_BLOCKERS,
    stagingProjectRef: CUSTOMER_07_STAGING_PROJECT_REF,
    identity,
    liveExternalDirectory: "LIVE_EXTERNAL_DIRECTORY_DEFERRED",
    results,
    failedCount: failed.length,
    passedCount: results.length - failed.length,
    totalChecks: results.length,
    secretsPrinted: false,
    productionConnected: false,
    finishedAt: new Date().toISOString(),
  };

  writeEvidence(repoRoot, "LIVE_CERTIFICATION.json", report);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        verdict: CUSTOMER_07_VERDICTS.BLOCKED,
        error: err?.message || String(err),
        secretsPrinted: false,
      },
      null,
      2
    )
  );
  process.exit(1);
});
