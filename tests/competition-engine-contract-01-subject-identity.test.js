/**
 * Contract #01 additive capability: resolveSubjectIdentity.
 * Point lookup by canonical subjectId. Existing actor capabilities unchanged.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { USER_STATUS } from "../src/models/user.js";
import { ROLES } from "../src/features/identity/constants/roles.js";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
} from "../src/features/competition-engine/integration/referee/constants.js";
import {
  COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
  EVIDENCE_STATUS,
  IDENTITY_ACCESS_CONTRACT,
  SHARED_ADAPTER_ERROR_CODE,
  TENANT_ORGANIZATION_CONTRACT,
  WORKSTREAM_CONTRACT_DEFINITIONS,
  WORKSTREAM_OWNED_CONTRACT_IDS,
  createDefaultWorkstreamAdapters,
  createIdentityAccessBinding,
  isCompetitionAdapterContractError,
  runCompetitionAdapterConformance,
} from "../src/features/competition-engine/integration/contracts/index.js";
import { createIdentityEvidenceFromIdentityAdapter } from "../src/features/competition-engine/integration/adapters/identityEvidenceFromIdentityAdapter.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BOUND_TENANT = "tenant-1";
const FOREIGN_TENANT = "tenant-foreign";
const SUBJECT_ID = "subject-canonical-1";
const FORBIDDEN_LOOKUPS = [
  "resolveSubjectIdentityByEmail",
  "resolveSubjectIdentityByPhone",
  "resolveSubjectIdentityByName",
  "searchSubjects",
  "listSubjects",
  "findRefereeByName",
  "bulkResolveIdentityDirectory",
];

const BASE_CTX = Object.freeze({
  contractVersion: COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
  tenantId: BOUND_TENANT,
  competitionId: "comp-1",
  actorId: "actor-1",
  correlationId: "corr-1",
  participantId: "player-1",
  clubId: "club-1",
  matchId: "match-1",
  effectiveAt: "2026-01-01T00:00:00Z",
  idempotencyKey: "idem-1",
  role: "TEAM_CAPTAIN",
});

function expectCode(fn, code) {
  try {
    const value = fn();
    if (value && typeof value.then === "function") {
      return value.then(
        () => {
          assert.fail(`expected ${code}`);
        },
        (err) => {
          assert.equal(isCompetitionAdapterContractError(err), true);
          assert.equal(err.code, code);
          assert.equal(err.failClosed, true);
        }
      );
    }
    assert.fail(`expected ${code}`);
  } catch (err) {
    assert.equal(isCompetitionAdapterContractError(err), true);
    assert.equal(err.code, code);
    assert.equal(err.failClosed, true);
  }
}

const HOME_VENUE = "venue-home-1";
const SHARED_UUID = "550e8400-e29b-41d4-a716-446655440000";

function identityRow(overrides = {}) {
  return {
    id: SUBJECT_ID,
    role: ROLES.REFEREE,
    status: USER_STATUS.ACTIVE,
    tenantId: BOUND_TENANT,
    venueId: HOME_VENUE,
    clubId: "club-1",
    email: "hidden@example.com",
    phone: "+84900000000",
    displayName: "Secret Name",
    ...overrides,
  };
}

function bindingWith(rows) {
  const map = new Map(rows.map((row) => [row.id, row]));
  return createIdentityAccessBinding({
    boundTenantId: BOUND_TENANT,
    loadIdentitySubjectById: async (subjectId) => map.get(subjectId) || null,
  });
}

test("01 existing resolveActorIdentity still works", () => {
  const identity = bindingWith([identityRow()]);
  const actor = identity.resolveActorIdentity(BASE_CTX);
  assert.equal(actor.status, EVIDENCE_STATUS.OK);
  assert.equal(actor.data.actorId, "actor-1");
});

test("02 existing getAuthorizationEvidence still works", async () => {
  const identity = bindingWith([identityRow()]);
  const auth = await identity.getAuthorizationEvidence(BASE_CTX);
  assert.equal(auth.status, EVIDENCE_STATUS.OK);
  assert.equal(auth.data.subjectId, "actor-1");
});

test("03 existing getCapabilityEvidence still works", async () => {
  const identity = bindingWith([identityRow()]);
  const caps = await identity.getCapabilityEvidence(BASE_CTX);
  assert.ok(Array.isArray(caps.data.grantedPermissions));
});

test("04 resolveSubjectIdentity resolves a known canonical subject by subjectId", async () => {
  const identity = bindingWith([identityRow()]);
  const evidence = await identity.resolveSubjectIdentity({
    ...BASE_CTX,
    subjectId: SUBJECT_ID,
  });
  assert.equal(evidence.status, EVIDENCE_STATUS.OK);
  assert.equal(evidence.data.subjectId, SUBJECT_ID);
  assert.equal(evidence.sourceSystem, "identity");
});

test("05 role is authoritative Identity role", async () => {
  const identity = bindingWith([identityRow({ role: "COURT_MANAGER" })]);
  const evidence = await identity.resolveSubjectIdentity({
    ...BASE_CTX,
    subjectId: SUBJECT_ID,
    role: ROLES.PLATFORM_ADMIN,
  });
  assert.equal(evidence.data.role, ROLES.VENUE_MANAGER);
  assert.notEqual(evidence.data.role, ROLES.PLATFORM_ADMIN);
});

test("06 active subject returns active evidence", async () => {
  const identity = bindingWith([identityRow({ status: USER_STATUS.ACTIVE })]);
  const evidence = await identity.resolveSubjectIdentity({
    ...BASE_CTX,
    subjectId: SUBJECT_ID,
  });
  assert.equal(evidence.data.active, true);
  assert.equal(evidence.data.status, USER_STATUS.ACTIVE);
});

test("07 inactive subject returns inactive evidence honestly", async () => {
  const identity = bindingWith([identityRow({ status: USER_STATUS.SUSPENDED })]);
  const evidence = await identity.resolveSubjectIdentity({
    ...BASE_CTX,
    subjectId: SUBJECT_ID,
    status: USER_STATUS.ACTIVE,
    active: true,
  });
  assert.equal(evidence.data.active, false);
  assert.equal(evidence.data.status, USER_STATUS.SUSPENDED);
});

test("08 missing subject returns canonical NOT_FOUND evidence", async () => {
  const identity = bindingWith([identityRow()]);
  const evidence = await identity.resolveSubjectIdentity({
    ...BASE_CTX,
    subjectId: "missing-subject",
  });
  assert.equal(evidence.status, EVIDENCE_STATUS.NOT_FOUND);
  assert.ok(evidence.reasonCodes.includes("SUBJECT_NOT_FOUND"));
  assert.equal(evidence.data.role, undefined);
});

test("09 malformed subjectId fails closed", async () => {
  const identity = bindingWith([identityRow()]);
  await expectCode(
    () => identity.resolveSubjectIdentity({ ...BASE_CTX, subjectId: "" }),
    SHARED_ADAPTER_ERROR_CODE.MISSING_REQUIRED_CONTEXT
  );
  await expectCode(
    () =>
      identity.resolveSubjectIdentity({
        ...BASE_CTX,
        subjectId: "ada@example.com",
      }),
    SHARED_ADAPTER_ERROR_CODE.FUZZY_IDENTITY_FORBIDDEN
  );
  await expectCode(
    () =>
      identity.resolveSubjectIdentity({
        ...BASE_CTX,
        subjectId: "John Smith",
      }),
    SHARED_ADAPTER_ERROR_CODE.DISPLAY_NAME_IS_NOT_IDENTITY
  );
});

test("10 foreign tenant cannot masquerade as local subject", async () => {
  const identity = bindingWith([
    identityRow({ tenantId: FOREIGN_TENANT, venueId: FOREIGN_TENANT }),
  ]);
  await expectCode(
    () =>
      identity.resolveSubjectIdentity({
        ...BASE_CTX,
        subjectId: SUBJECT_ID,
      }),
    SHARED_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT
  );
});

test("11 caller-provided fake role is ignored", async () => {
  const identity = bindingWith([identityRow({ role: ROLES.REFEREE })]);
  const evidence = await identity.resolveSubjectIdentity({
    ...BASE_CTX,
    subjectId: SUBJECT_ID,
    role: ROLES.PLATFORM_ADMIN,
    subjectRole: ROLES.PLATFORM_ADMIN,
  });
  assert.equal(evidence.data.role, ROLES.REFEREE);
});

test("12 caller-provided fake active status is ignored", async () => {
  const identity = bindingWith([identityRow({ status: USER_STATUS.SUSPENDED })]);
  const evidence = await identity.resolveSubjectIdentity({
    ...BASE_CTX,
    subjectId: SUBJECT_ID,
    status: USER_STATUS.ACTIVE,
    active: true,
  });
  assert.equal(evidence.data.active, false);
});

test("13 caller-provided fake tenant/scope is ignored", async () => {
  const identity = bindingWith([
    identityRow({ tenantId: FOREIGN_TENANT, venueId: FOREIGN_TENANT }),
  ]);
  await expectCode(
    () =>
      identity.resolveSubjectIdentity({
        ...BASE_CTX,
        subjectId: SUBJECT_ID,
        claimedTenantId: BOUND_TENANT,
        resourceTenantId: BOUND_TENANT,
        subjectTenantId: BOUND_TENANT,
      }),
    SHARED_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT
  );
});

test("14-17 no email/phone/name/bulk directory lookup methods", () => {
  const identity = bindingWith([identityRow()]);
  for (const method of FORBIDDEN_LOOKUPS) {
    assert.equal(typeof identity[method], "undefined", method);
    assert.ok(IDENTITY_ACCESS_CONTRACT.forbiddenMethods.includes(method), method);
  }
});

test("18 Competition adapter does not query profiles directly", () => {
  const adapterSrc = readFileSync(
    path.join(
      ROOT,
      "src/features/competition-engine/integration/adapters/identityEvidenceFromIdentityAdapter.js"
    ),
    "utf8"
  );
  const bindingSrc = readFileSync(
    path.join(
      ROOT,
      "src/features/competition-engine/integration/contracts/bindings.js"
    ),
    "utf8"
  );
  for (const src of [adapterSrc, bindingSrc]) {
    assert.equal(src.includes(".from(\"profiles\")"), false);
    assert.equal(src.includes(".from('profiles')"), false);
    assert.equal(src.includes("auth/supabaseClient"), false);
    assert.equal(src.includes("@supabase/supabase-js"), false);
  }
  assert.ok(adapterSrc.includes("subjectIdentityLookupService"));
});

test("19 Identity private persistence remains inside Identity domain", () => {
  const serviceSrc = readFileSync(
    path.join(
      ROOT,
      "src/features/identity/services/subjectIdentityLookupService.js"
    ),
    "utf8"
  );
  assert.ok(serviceSrc.includes("subjectIdentityPersistence"));
  assert.ok(serviceSrc.includes("defaultLoadIdentitySubjectById"));
  assert.equal(serviceSrc.includes("resolveRefereeIdentity"), false);
  assert.equal(serviceSrc.includes("profileService"), false);
  assert.equal(serviceSrc.includes("record.tenantId || record.venueId"), false);
  assert.equal(/:\s*USER_STATUS\.ACTIVE/.test(serviceSrc), false);
  const persistenceSrc = readFileSync(
    path.join(
      ROOT,
      "src/features/identity/services/subjectIdentityPersistence.js"
    ),
    "utf8"
  );
  assert.ok(persistenceSrc.includes("getSupabaseAuthClient"));
  assert.ok(persistenceSrc.includes("tenant_id"));
  assert.ok(persistenceSrc.includes("venue_id"));
  assert.equal(persistenceSrc.includes("profileService"), false);
  assert.equal(persistenceSrc.includes("competition-engine"), false);
});

test("20 Contract #02 is unchanged", () => {
  assert.deepEqual(TENANT_ORGANIZATION_CONTRACT.requiredMethods, [
    "resolveTenantIdentity",
    "validateScope",
    "distinguishScopeIds",
    "resolveOrganizationIdentity",
    "getOrganizationStatus",
  ]);
  assert.equal(
    TENANT_ORGANIZATION_CONTRACT.contractId,
    "competition.tenant-organization.adapter.v1"
  );
  assert.equal(TENANT_ORGANIZATION_CONTRACT.contractVersion, "1.0.0");
});

test("21 Contract #08 is unchanged", () => {
  assert.equal(
    COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    "competition.referee.adapter.v1"
  );
  assert.equal(COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION, "1.0.0");
  assert.equal(
    WORKSTREAM_OWNED_CONTRACT_IDS.includes("competition.referee.adapter.v1"),
    false
  );
});

test("22 no Contract #17", () => {
  assert.equal(WORKSTREAM_OWNED_CONTRACT_IDS.length, 14);
  assert.equal(WORKSTREAM_CONTRACT_DEFINITIONS.length, 14);
  assert.equal(
    WORKSTREAM_OWNED_CONTRACT_IDS.some((id) => id.includes("adapter.v2")),
    false
  );
  assert.equal(
    WORKSTREAM_CONTRACT_DEFINITIONS.some((def) => def.ordinal === 17),
    false
  );
});

test("23 existing Contract #01 consumers remain compatible", async () => {
  const adapters = createDefaultWorkstreamAdapters({
    boundTenantId: BOUND_TENANT,
    identity: {
      boundTenantId: BOUND_TENANT,
      loadIdentitySubjectById: async () => identityRow(),
    },
  });
  const identity = adapters.find(
    (row) => row.contractId === IDENTITY_ACCESS_CONTRACT.contractId
  );
  assert.equal(typeof identity.resolveActorIdentity, "function");
  assert.equal(typeof identity.getAuthorizationEvidence, "function");
  assert.equal(typeof identity.getCapabilityEvidence, "function");
  const report = await runCompetitionAdapterConformance(identity, null, {
    validContext: BASE_CTX,
  });
  assert.equal(report.ok, true, JSON.stringify(report.results.filter((row) => !row.ok)));
});

test("24 production binding implements resolveSubjectIdentity", () => {
  const identity = bindingWith([identityRow()]);
  assert.equal(identity.productionBinding, "BOUND");
  assert.equal(typeof identity.resolveSubjectIdentity, "function");
  assert.equal(identity.contractVersion, "1.0.0");
});

test("25 conformance/catalog/binding agree on the capability", () => {
  assert.ok(
    IDENTITY_ACCESS_CONTRACT.requiredMethods.includes("resolveSubjectIdentity")
  );
  assert.ok(
    IDENTITY_ACCESS_CONTRACT.capabilities.some(
      (cap) => cap.name === "resolveSubjectIdentity" && cap.kind === "QUERY"
    )
  );
  const identity = bindingWith([identityRow()]);
  assert.ok(identity.requiredMethods.includes("resolveSubjectIdentity"));
  assert.equal(identity.contractId, IDENTITY_ACCESS_CONTRACT.contractId);
  assert.equal(identity.contractVersion, IDENTITY_ACCESS_CONTRACT.contractVersion);
});

test("26 Identity authority remains single and Adapter B is translation only", async () => {
  const port = createIdentityEvidenceFromIdentityAdapter({
    loadIdentitySubjectById: async () => identityRow({ role: "VENUE_OWNER" }),
  });
  const result = await port.resolveSubjectIdentity({
    subjectId: SUBJECT_ID,
    requestedTenantId: BOUND_TENANT,
  });
  assert.equal(result.ok, true);
  assert.equal(result.evidence.role, ROLES.TENANT_OWNER);
  assert.equal(IDENTITY_ACCESS_CONTRACT.authorityOwner, "src/features/identity");
  assert.equal(typeof port.grantPermission, "undefined");
  assert.equal(typeof port.createRole, "undefined");
});

test("PII is minimized on Contract #01 subject evidence", async () => {
  const identity = bindingWith([identityRow()]);
  const evidence = await identity.resolveSubjectIdentity({
    ...BASE_CTX,
    subjectId: SUBJECT_ID,
  });
  const serialized = JSON.stringify(evidence);
  assert.equal(serialized.includes("hidden@example.com"), false);
  assert.equal(serialized.includes("+84900000000"), false);
  assert.equal(serialized.includes("Secret Name"), false);
  assert.equal(evidence.data.email, undefined);
  assert.equal(evidence.data.phone, undefined);
  assert.equal(evidence.data.displayName, undefined);
});

test("phone subjectId is rejected as fuzzy identity", async () => {
  const identity = bindingWith([identityRow()]);
  await expectCode(
    () =>
      identity.resolveSubjectIdentity({
        ...BASE_CTX,
        subjectId: "+84901234567",
      }),
    SHARED_ADAPTER_ERROR_CODE.FUZZY_IDENTITY_FORBIDDEN
  );
});

test("T01 tenantId never falls back to venueId on Contract #01", async () => {
  const identity = bindingWith([
    identityRow({ tenantId: null, venueId: BOUND_TENANT }),
  ]);
  await expectCode(
    () =>
      identity.resolveSubjectIdentity({
        ...BASE_CTX,
        subjectId: SUBJECT_ID,
      }),
    SHARED_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY
  );
});

test("T01 venueId remains distinct when tenant evidence exists", async () => {
  const identity = bindingWith([identityRow()]);
  const evidence = await identity.resolveSubjectIdentity({
    ...BASE_CTX,
    subjectId: SUBJECT_ID,
  });
  assert.equal(evidence.data.tenantId, BOUND_TENANT);
  assert.equal(evidence.data.venueId, HOME_VENUE);
  assert.notEqual(evidence.data.tenantId, evidence.data.venueId);
  assert.equal(evidence.data.scopeIds.tenantId, BOUND_TENANT);
  assert.equal(evidence.data.scopeIds.venueId, HOME_VENUE);
});

test("T01 same UUID on tenantId and venueId is two fields, not one authority", async () => {
  const identity = bindingWith([
    identityRow({ tenantId: SHARED_UUID, venueId: SHARED_UUID }),
  ]);
  await expectCode(
    () =>
      identity.resolveSubjectIdentity({
        ...BASE_CTX,
        tenantId: BOUND_TENANT,
        subjectId: SUBJECT_ID,
      }),
    SHARED_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT
  );
  const matching = createIdentityAccessBinding({
    boundTenantId: SHARED_UUID,
    loadIdentitySubjectById: async () =>
      identityRow({ tenantId: SHARED_UUID, venueId: SHARED_UUID }),
  });
  const evidence = await matching.resolveSubjectIdentity({
    ...BASE_CTX,
    tenantId: SHARED_UUID,
    subjectId: SUBJECT_ID,
  });
  assert.equal(evidence.data.tenantId, SHARED_UUID);
  assert.equal(evidence.data.venueId, SHARED_UUID);
  assert.ok(Object.prototype.hasOwnProperty.call(evidence.data.scopeIds, "tenantId"));
  assert.ok(Object.prototype.hasOwnProperty.call(evidence.data.scopeIds, "venueId"));
});

test("T01 requested tenant + matching tenant PASSES with distinct venue", async () => {
  const identity = bindingWith([
    identityRow({ tenantId: BOUND_TENANT, venueId: HOME_VENUE }),
  ]);
  const evidence = await identity.resolveSubjectIdentity({
    ...BASE_CTX,
    subjectId: SUBJECT_ID,
  });
  assert.equal(evidence.status, EVIDENCE_STATUS.OK);
  assert.equal(evidence.data.tenantId, BOUND_TENANT);
  assert.equal(evidence.data.venueId, HOME_VENUE);
});

test("T01 requested tenant + foreign tenant DENIES even if venue matches request", async () => {
  const identity = bindingWith([
    identityRow({ tenantId: FOREIGN_TENANT, venueId: BOUND_TENANT }),
  ]);
  await expectCode(
    () =>
      identity.resolveSubjectIdentity({
        ...BASE_CTX,
        subjectId: SUBJECT_ID,
      }),
    SHARED_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT
  );
});

test("T02 missing status fails closed", async () => {
  const identity = bindingWith([identityRow({ status: null })]);
  await expectCode(
    () =>
      identity.resolveSubjectIdentity({
        ...BASE_CTX,
        subjectId: SUBJECT_ID,
      }),
    SHARED_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY
  );
});

test("T02 INACTIVE status is returned as active=false", async () => {
  const identity = bindingWith([identityRow({ status: "inactive" })]);
  const evidence = await identity.resolveSubjectIdentity({
    ...BASE_CTX,
    subjectId: SUBJECT_ID,
  });
  assert.equal(evidence.data.active, false);
  assert.equal(evidence.data.status, "inactive");
});

test("19 Platform Core future tenant/venue separation is compatible", async () => {
  const identity = bindingWith([
    identityRow({
      tenantId: BOUND_TENANT,
      tenant_id: BOUND_TENANT,
      venueId: HOME_VENUE,
      venue_id: HOME_VENUE,
    }),
  ]);
  const evidence = await identity.resolveSubjectIdentity({
    ...BASE_CTX,
    subjectId: SUBJECT_ID,
  });
  assert.equal(evidence.data.tenantId, BOUND_TENANT);
  assert.equal(evidence.data.venueId, HOME_VENUE);
  assert.notEqual(evidence.data.tenantId, evidence.data.venueId);
  assert.equal(evidence.data.canonicalSubjectId, SUBJECT_ID);
});
