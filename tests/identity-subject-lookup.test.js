/**
 * Identity-domain point lookup for Competition-safe subject identity evidence.
 * Canonical subjectId only. Not a directory/search API.
 * Tenant is not venue. Missing status is never synthesized as ACTIVE.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { USER_STATUS } from "../src/models/user.js";
import { ROLES } from "../src/features/identity/constants/roles.js";
import {
  authoritativeStatus,
  authoritativeTenantId,
  authoritativeVenueId,
  isCanonicalSubjectId,
  resolveSubjectIdentityRecord,
  SUBJECT_IDENTITY_EVIDENCE_VERSION,
  SUBJECT_IDENTITY_LOOKUP_CODE,
} from "../src/features/identity/services/subjectIdentityLookupService.js";
import {
  loadIdentitySubjectByIdFromPersistence,
  projectRawIdentitySubjectRecord,
  SUBJECT_IDENTITY_RAW_FIELDS,
} from "../src/features/identity/services/subjectIdentityPersistence.js";
import * as identityPublicApi from "../src/features/identity/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_TENANT = "tenant-1";
const FOREIGN_TENANT = "tenant-foreign";
const HOME_VENUE = "venue-home-1";
const SHARED_UUID = "550e8400-e29b-41d4-a716-446655440000";

function record(overrides = {}) {
  return {
    id: "subject-1",
    role: ROLES.REFEREE,
    status: USER_STATUS.ACTIVE,
    tenantId: LOCAL_TENANT,
    venueId: HOME_VENUE,
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
  assert.equal(result.evidence.canonicalSubjectId, "subject-1");
  assert.equal(result.evidence.role, ROLES.REFEREE);
  assert.equal(result.evidence.active, true);
  assert.equal(result.evidence.status, USER_STATUS.ACTIVE);
  assert.equal(result.evidence.tenantId, LOCAL_TENANT);
  assert.equal(result.evidence.venueId, HOME_VENUE);
  assert.equal(result.evidence.clubId, "club-1");
  assert.equal(result.evidence.matchesRequestedTenant, true);
  assert.equal(result.evidence.evidenceVersion, SUBJECT_IDENTITY_EVIDENCE_VERSION);
  assert.equal(result.evidence.email, undefined);
  assert.equal(result.evidence.phone, undefined);
  assert.equal(result.evidence.displayName, undefined);
  assert.equal(result.evidence.mustChangePassword, undefined);
});

test("01 tenantId never falls back to venueId", async () => {
  assert.equal(
    authoritativeTenantId({ venueId: HOME_VENUE, venue_id: HOME_VENUE }),
    null
  );
  const result = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1" },
    {
      loadIdentitySubjectById: loaderFrom([
        record({ tenantId: null, tenant_id: null, venueId: HOME_VENUE }),
      ]),
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.evidence.tenantId, null);
  assert.equal(result.evidence.venueId, HOME_VENUE);
  assert.notEqual(result.evidence.tenantId, result.evidence.venueId);
});

test("02 venueId remains distinct from tenantId", async () => {
  assert.equal(
    authoritativeVenueId({ tenantId: LOCAL_TENANT, tenant_id: LOCAL_TENANT }),
    null
  );
  const result = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1", requestedTenantId: LOCAL_TENANT },
    {
      loadIdentitySubjectById: loaderFrom([
        record({ tenantId: LOCAL_TENANT, venueId: HOME_VENUE }),
      ]),
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.evidence.tenantId, LOCAL_TENANT);
  assert.equal(result.evidence.venueId, HOME_VENUE);
  assert.notEqual(result.evidence.tenantId, result.evidence.venueId);
  assert.equal(result.evidence.scopeIds.tenantId, LOCAL_TENANT);
  assert.equal(result.evidence.scopeIds.venueId, HOME_VENUE);
});

test("03 same string value for tenantId and venueId is two entities", async () => {
  const result = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1", requestedTenantId: SHARED_UUID },
    {
      loadIdentitySubjectById: loaderFrom([
        record({ tenantId: SHARED_UUID, venueId: SHARED_UUID }),
      ]),
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.evidence.tenantId, SHARED_UUID);
  assert.equal(result.evidence.venueId, SHARED_UUID);
  assert.notEqual(result.evidence.scopeIds.tenantId, undefined);
  assert.ok(Object.prototype.hasOwnProperty.call(result.evidence.scopeIds, "tenantId"));
  assert.ok(Object.prototype.hasOwnProperty.call(result.evidence.scopeIds, "venueId"));
  assert.equal(result.evidence.scopeIds.tenantId, result.evidence.scopeIds.venueId);
});

test("04 profile with venueId but no tenantId does not produce tenantId=venueId", async () => {
  const projected = projectRawIdentitySubjectRecord({
    id: "subject-1",
    role: ROLES.REFEREE,
    status: USER_STATUS.ACTIVE,
    venue_id: HOME_VENUE,
    club_id: "club-1",
  });
  assert.equal(projected.tenantId, null);
  assert.equal(projected.venueId, HOME_VENUE);

  const result = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1" },
    { loadIdentitySubjectById: loaderFrom([projected]) }
  );
  assert.equal(result.ok, true);
  assert.equal(result.evidence.tenantId, null);
  assert.equal(result.evidence.venueId, HOME_VENUE);
});

test("05 requested tenant + missing authoritative tenant fails closed", async () => {
  const result = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1", requestedTenantId: LOCAL_TENANT },
    {
      loadIdentitySubjectById: loaderFrom([
        record({ tenantId: null, venueId: LOCAL_TENANT }),
      ]),
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, SUBJECT_IDENTITY_LOOKUP_CODE.MISSING_SCOPE_EVIDENCE);
  assert.equal(result.evidence.tenantId, null);
  assert.equal(result.evidence.venueId, LOCAL_TENANT);
  assert.equal(result.evidence.matchesRequestedTenant, false);
});

test("06 requested tenant + matching authoritative tenant PASSES", async () => {
  const result = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1", requestedTenantId: LOCAL_TENANT },
    {
      loadIdentitySubjectById: loaderFrom([
        record({ tenantId: LOCAL_TENANT, venueId: HOME_VENUE }),
      ]),
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.evidence.tenantId, LOCAL_TENANT);
  assert.equal(result.evidence.matchesRequestedTenant, true);
});

test("07 requested tenant + foreign authoritative tenant DENIES", async () => {
  const result = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1", requestedTenantId: LOCAL_TENANT },
    {
      loadIdentitySubjectById: loaderFrom([
        record({ tenantId: FOREIGN_TENANT, venueId: LOCAL_TENANT }),
      ]),
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, SUBJECT_IDENTITY_LOOKUP_CODE.SCOPE_MISMATCH);
  assert.equal(result.evidence.tenantId, FOREIGN_TENANT);
  assert.equal(result.evidence.venueId, LOCAL_TENANT);
  assert.equal(result.evidence.role, undefined);
  assert.equal(result.evidence.active, undefined);
});

test("08 missing status fails closed as incomplete evidence", async () => {
  assert.equal(authoritativeStatus(null), null);
  assert.equal(authoritativeStatus(""), null);
  assert.equal(authoritativeStatus("   "), null);
  assert.equal(authoritativeStatus("unknown-status"), null);

  const missing = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1", requestedTenantId: LOCAL_TENANT },
    { loadIdentitySubjectById: loaderFrom([record({ status: null })]) }
  );
  assert.equal(missing.ok, false);
  assert.equal(missing.code, SUBJECT_IDENTITY_LOOKUP_CODE.INCOMPLETE_IDENTITY);
  assert.equal(missing.evidence.active, undefined);

  const blank = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1", requestedTenantId: LOCAL_TENANT },
    { loadIdentitySubjectById: loaderFrom([record({ status: "" })]) }
  );
  assert.equal(blank.ok, false);
  assert.equal(blank.code, SUBJECT_IDENTITY_LOOKUP_CODE.INCOMPLETE_IDENTITY);
});

test("09 explicit ACTIVE yields active=true", async () => {
  const result = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1", requestedTenantId: LOCAL_TENANT },
    { loadIdentitySubjectById: loaderFrom([record({ status: USER_STATUS.ACTIVE })]) }
  );
  assert.equal(result.ok, true);
  assert.equal(result.evidence.active, true);
  assert.equal(result.evidence.status, USER_STATUS.ACTIVE);
});

test("10 explicit SUSPENDED/INACTIVE yields active=false", async () => {
  const suspended = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1", requestedTenantId: LOCAL_TENANT },
    {
      loadIdentitySubjectById: loaderFrom([
        record({ status: USER_STATUS.SUSPENDED }),
      ]),
    }
  );
  assert.equal(suspended.ok, true);
  assert.equal(suspended.evidence.active, false);
  assert.equal(suspended.evidence.status, USER_STATUS.SUSPENDED);

  const inactive = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1", requestedTenantId: LOCAL_TENANT },
    { loadIdentitySubjectById: loaderFrom([record({ status: "INACTIVE" })]) }
  );
  assert.equal(inactive.ok, true);
  assert.equal(inactive.evidence.active, false);
  assert.equal(inactive.evidence.status, "inactive");
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

test("11 role remains Identity-authoritative", async () => {
  const result = await resolveSubjectIdentityRecord(
    {
      subjectId: "subject-1",
      requestedTenantId: LOCAL_TENANT,
      role: ROLES.PLATFORM_ADMIN,
    },
    { loadIdentitySubjectById: loaderFrom([record({ role: "COURT_MANAGER" })]) }
  );
  assert.equal(result.ok, true);
  assert.equal(result.evidence.role, ROLES.VENUE_MANAGER);
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

test("venueId matching requestedTenantId is not tenant proof", async () => {
  const result = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1", requestedTenantId: LOCAL_TENANT },
    {
      loadIdentitySubjectById: loaderFrom([
        record({ tenantId: null, venueId: LOCAL_TENANT }),
      ]),
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, SUBJECT_IDENTITY_LOOKUP_CODE.MISSING_SCOPE_EVIDENCE);
});

test("platform-wide role may pass without tenant evidence, not via venue equality", async () => {
  const result = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1", requestedTenantId: LOCAL_TENANT },
    {
      loadIdentitySubjectById: loaderFrom([
        record({
          role: ROLES.PLATFORM_ADMIN,
          tenantId: null,
          venueId: HOME_VENUE,
        }),
      ]),
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.evidence.tenantId, null);
  assert.equal(result.evidence.venueId, HOME_VENUE);
  assert.equal(result.evidence.role, ROLES.PLATFORM_ADMIN);
});

test("19 Platform Core tenant/venue separation is compatible", async () => {
  const result = await resolveSubjectIdentityRecord(
    { subjectId: "subject-1", requestedTenantId: LOCAL_TENANT },
    {
      loadIdentitySubjectById: loaderFrom([
        record({
          tenant_id: LOCAL_TENANT,
          tenantId: LOCAL_TENANT,
          venue_id: HOME_VENUE,
          venueId: HOME_VENUE,
        }),
      ]),
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.evidence.tenantId, LOCAL_TENANT);
  assert.equal(result.evidence.venueId, HOME_VENUE);
  assert.notEqual(result.evidence.tenantId, result.evidence.venueId);
});

test("Identity public API does not add directory/search subject lookups", () => {
  assert.equal(typeof identityPublicApi.resolveSubjectIdentityRecord, "function");
  assert.equal(typeof identityPublicApi.createIdentitySubjectPointLoader, "function");
  assert.equal(identityPublicApi.loadIdentitySubjectByIdFromPersistence, undefined);
  assert.equal(identityPublicApi.resolveSubjectIdentityByEmail, undefined);
  assert.equal(identityPublicApi.resolveSubjectIdentityByPhone, undefined);
  assert.equal(identityPublicApi.resolveSubjectIdentityByName, undefined);
  assert.equal(identityPublicApi.searchSubjects, undefined);
  assert.equal(identityPublicApi.listSubjects, undefined);
  assert.equal(identityPublicApi.findRefereeByName, undefined);
  assert.equal(identityPublicApi.bulkResolveIdentityDirectory, undefined);
});

test("raw persistence projection never copies venue onto tenant or synthesizes ACTIVE", () => {
  const projected = projectRawIdentitySubjectRecord({
    id: "subject-1",
    role: ROLES.REFEREE,
    venue_id: HOME_VENUE,
    club_id: "club-1",
    email: "hidden@example.com",
    phone: "+84900000000",
  });
  assert.equal(projected.tenantId, null);
  assert.equal(projected.venueId, HOME_VENUE);
  assert.equal(projected.status, null);
  assert.equal(projected.email, undefined);
  assert.equal(projected.phone, undefined);
  assert.deepEqual([...SUBJECT_IDENTITY_RAW_FIELDS], [
    "id",
    "role",
    "status",
    "tenant_id",
    "venue_id",
    "club_id",
  ]);
});

test("raw persistence point lookup selects only Identity scope fields", async () => {
  const selects = [];
  const client = {
    from(table) {
      assert.equal(table, "profiles");
      return {
        select(fields) {
          selects.push(fields);
          return {
            eq(_column, id) {
              assert.equal(id, "subject-1");
              return {
                maybeSingle: async () => ({
                  data: {
                    id: "subject-1",
                    role: ROLES.REFEREE,
                    status: USER_STATUS.ACTIVE,
                    tenant_id: LOCAL_TENANT,
                    venue_id: HOME_VENUE,
                    club_id: "club-1",
                  },
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
  };

  const loaded = await loadIdentitySubjectByIdFromPersistence("subject-1", {
    getAuthClient: () => client,
  });
  assert.equal(selects[0], "id, role, status, tenant_id, venue_id, club_id");
  assert.equal(selects[0].includes("email"), false);
  assert.equal(selects[0].includes("phone"), false);
  assert.equal(selects[0].includes("display_name"), false);
  assert.equal(loaded.tenantId, LOCAL_TENANT);
  assert.equal(loaded.venueId, HOME_VENUE);
  assert.equal(loaded.email, undefined);
});

test("raw persistence treats missing tenant_id column as null tenant, not venue", async () => {
  let attempt = 0;
  const client = {
    from() {
      return {
        select(fields) {
          return {
            eq() {
              return {
                maybeSingle: async () => {
                  attempt += 1;
                  if (attempt === 1) {
                    assert.ok(fields.includes("tenant_id"));
                    return {
                      data: null,
                      error: { message: "column profiles.tenant_id does not exist" },
                    };
                  }
                  assert.equal(fields.includes("tenant_id"), false);
                  return {
                    data: {
                      id: "subject-1",
                      role: ROLES.REFEREE,
                      status: USER_STATUS.ACTIVE,
                      venue_id: HOME_VENUE,
                      club_id: "club-1",
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const loaded = await loadIdentitySubjectByIdFromPersistence("subject-1", {
    getAuthClient: () => client,
  });
  assert.equal(loaded.tenantId, null);
  assert.equal(loaded.venueId, HOME_VENUE);
});

test("lookup and persistence sources never fallback tenant to venue or default ACTIVE", () => {
  const lookupSrc = readFileSync(
    path.join(ROOT, "src/features/identity/services/subjectIdentityLookupService.js"),
    "utf8"
  );
  const persistenceSrc = readFileSync(
    path.join(ROOT, "src/features/identity/services/subjectIdentityPersistence.js"),
    "utf8"
  );
  assert.equal(lookupSrc.includes("record.tenantId || record.venueId"), false);
  assert.equal(lookupSrc.includes("evidence.venueId === requestedTenantId"), false);
  assert.equal(/:\s*USER_STATUS\.ACTIVE/.test(lookupSrc), false);
  assert.equal(lookupSrc.includes("profileService"), false);
  assert.equal(persistenceSrc.includes("profileService"), false);
  assert.equal(persistenceSrc.includes("tenantId: venueId"), false);
  assert.equal(persistenceSrc.includes("status: row.status ||"), false);
});
