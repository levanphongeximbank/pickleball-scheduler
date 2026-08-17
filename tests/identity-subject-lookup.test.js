/**
 * Identity-domain point lookup for Competition-safe subject identity evidence.
 * Canonical subjectId only. Not a directory/search API.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { USER_STATUS } from "../src/models/user.js";
import { ROLES } from "../src/features/identity/constants/roles.js";
import {
  isCanonicalSubjectId,
  resolveSubjectIdentityRecord,
  SUBJECT_IDENTITY_EVIDENCE_VERSION,
  SUBJECT_IDENTITY_LOOKUP_CODE,
} from "../src/features/identity/services/subjectIdentityLookupService.js";
import * as identityPublicApi from "../src/features/identity/index.js";

const LOCAL_TENANT = "tenant-1";
const FOREIGN_TENANT = "tenant-foreign";

function record(overrides = {}) {
  return {
    id: "subject-1",
    role: ROLES.REFEREE,
    status: USER_STATUS.ACTIVE,
    tenantId: LOCAL_TENANT,
    venueId: LOCAL_TENANT,
    clubId: "club-1",
    email: "hidden@example.com",
    phone: "+84900000000",
    displayName: "Secret Name",
    mustChangePassword: true,
    ...overrides,
  };
}

function loaderFrom(rows) {
  const map = new Map(rows.map((row) => [row.id, row]));
  return async (subjectId) => map.get(subjectId) || null;
}

test("canonical subjectId accepts opaque ids and rejects email/phone/name", () => {
  assert.equal(isCanonicalSubjectId("subject-1"), true);
  assert.equal(
    isCanonicalSubjectId("550e8400-e29b-41d4-a716-446655440000"),
    true
  );
  assert.equal(isCanonicalSubjectId("ada@example.com"), false);
  assert.equal(isCanonicalSubjectId("+84901234567"), false);
  assert.equal(isCanonicalSubjectId("John Smith"), false);
  assert.equal(isCanonicalSubjectId(""), false);
  assert.equal(isCanonicalSubjectId(null), false);
});

test("point lookup returns Competition-safe Identity evidence", async () => {
  const result = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1", requestedTenantId: LOCAL_TENANT },
    { loadIdentitySubjectById: loaderFrom([record()]) }
  );
  assert.equal(result.ok, true);
  assert.equal(result.code, SUBJECT_IDENTITY_LOOKUP_CODE.OK);
  assert.equal(result.evidence.subjectId, "subject-1");
  assert.equal(result.evidence.role, ROLES.REFEREE);
  assert.equal(result.evidence.active, true);
  assert.equal(result.evidence.status, USER_STATUS.ACTIVE);
  assert.equal(result.evidence.tenantId, LOCAL_TENANT);
  assert.equal(result.evidence.venueId, LOCAL_TENANT);
  assert.equal(result.evidence.clubId, "club-1");
  assert.equal(result.evidence.matchesRequestedTenant, true);
  assert.equal(result.evidence.evidenceVersion, SUBJECT_IDENTITY_EVIDENCE_VERSION);
  assert.equal(result.evidence.email, undefined);
  assert.equal(result.evidence.phone, undefined);
  assert.equal(result.evidence.displayName, undefined);
  assert.equal(result.evidence.mustChangePassword, undefined);
});

test("inactive subject is returned honestly as inactive", async () => {
  const result = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1", requestedTenantId: LOCAL_TENANT },
    {
      loadIdentitySubjectById: loaderFrom([
        record({ status: USER_STATUS.SUSPENDED }),
      ]),
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.evidence.active, false);
  assert.equal(result.evidence.status, USER_STATUS.SUSPENDED);
});

test("caller-supplied role/status/tenant are ignored", async () => {
  const result = await resolveSubjectIdentityRecord(
    {
      subjectId: "subject-1",
      requestedTenantId: LOCAL_TENANT,
      role: ROLES.PLATFORM_ADMIN,
      status: USER_STATUS.ACTIVE,
      active: true,
      tenantId: LOCAL_TENANT,
    },
    {
      loadIdentitySubjectById: loaderFrom([
        record({ role: "COURT_MANAGER", status: USER_STATUS.INVITED }),
      ]),
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.evidence.role, ROLES.VENUE_MANAGER);
  assert.equal(result.evidence.active, false);
  assert.equal(result.evidence.status, USER_STATUS.INVITED);
});

test("missing and malformed subjectId fail closed", async () => {
  const deps = { loadIdentitySubjectById: loaderFrom([record()]) };
  const missing = await resolveSubjectIdentityRecord({ requestedTenantId: LOCAL_TENANT }, deps);
  assert.equal(missing.ok, false);
  assert.equal(missing.code, SUBJECT_IDENTITY_LOOKUP_CODE.MISSING_SUBJECT_ID);

  const unknown = await resolveSubjectIdentityRecord(
    { subjectId: "missing-subject", requestedTenantId: LOCAL_TENANT },
    deps
  );
  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, SUBJECT_IDENTITY_LOOKUP_CODE.SUBJECT_NOT_FOUND);

  const email = await resolveSubjectIdentityRecord(
    { subjectId: "ada@example.com", requestedTenantId: LOCAL_TENANT },
    deps
  );
  assert.equal(email.ok, false);
  assert.equal(email.code, SUBJECT_IDENTITY_LOOKUP_CODE.FUZZY_IDENTITY_FORBIDDEN);

  const phone = await resolveSubjectIdentityRecord(
    { subjectId: "+84901234567", requestedTenantId: LOCAL_TENANT },
    deps
  );
  assert.equal(phone.ok, false);
  assert.equal(phone.code, SUBJECT_IDENTITY_LOOKUP_CODE.FUZZY_IDENTITY_FORBIDDEN);

  const name = await resolveSubjectIdentityRecord(
    { subjectId: "John Smith", requestedTenantId: LOCAL_TENANT },
    deps
  );
  assert.equal(name.ok, false);
  assert.equal(name.code, SUBJECT_IDENTITY_LOOKUP_CODE.DISPLAY_NAME_IS_NOT_IDENTITY);
});

test("foreign tenant cannot masquerade as local subject", async () => {
  const result = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1", requestedTenantId: LOCAL_TENANT },
    {
      loadIdentitySubjectById: loaderFrom([
        record({ tenantId: FOREIGN_TENANT, venueId: FOREIGN_TENANT }),
      ]),
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, SUBJECT_IDENTITY_LOOKUP_CODE.SCOPE_MISMATCH);
  assert.equal(result.evidence.tenantId, FOREIGN_TENANT);
  assert.equal(result.evidence.role, undefined);
  assert.equal(result.evidence.active, undefined);
});

test("Identity public API does not add directory/search subject lookups", () => {
  assert.equal(typeof identityPublicApi.resolveSubjectIdentityRecord, "function");
  assert.equal(identityPublicApi.resolveSubjectIdentityByEmail, undefined);
  assert.equal(identityPublicApi.resolveSubjectIdentityByPhone, undefined);
  assert.equal(identityPublicApi.resolveSubjectIdentityByName, undefined);
  assert.equal(identityPublicApi.searchSubjects, undefined);
  assert.equal(identityPublicApi.listSubjects, undefined);
  assert.equal(identityPublicApi.findRefereeByName, undefined);
  assert.equal(identityPublicApi.bulkResolveIdentityDirectory, undefined);
});
