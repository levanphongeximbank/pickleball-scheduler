import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  mapProfileRowToUser,
  mapUserToProfileRow,
  mapUserToSelfProfilePatch,
  PROFILE_FIELD_MAP,
  SELF_EDITABLE_PROFILE_FIELDS,
} from "../src/auth/profileService.js";
import { createUserRecord } from "../src/models/user.js";
import { ROLES } from "../src/features/identity/constants/roles.js";
import {
  authoritativeTenantId,
  authoritativeVenueId,
} from "../src/features/identity/services/subjectIdentityLookupService.js";
import { projectRawIdentitySubjectRecord } from "../src/features/identity/services/subjectIdentityPersistence.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROFILE_SOURCE = readFileSync(path.join(ROOT, "src/auth/profileService.js"), "utf8");

test("PROFILE_FIELD_MAP declares tenant_id independently from venue_id", () => {
  assert.equal(PROFILE_FIELD_MAP.tenantId, "tenant_id");
  assert.equal(PROFILE_FIELD_MAP.venueId, "venue_id");
  assert.notEqual(PROFILE_FIELD_MAP.tenantId, PROFILE_FIELD_MAP.venueId);
});

test("mapUserToProfileRow persists tenantId only", () => {
  const row = mapUserToProfileRow(
    createUserRecord({
      id: "user-1",
      email: "a@example.com",
      role: ROLES.REFEREE,
      tenantId: "tenant-a",
    })
  );
  assert.equal(row.tenant_id, "tenant-a");
  assert.equal(row.venue_id, null);
});

test("mapUserToProfileRow persists venueId only", () => {
  const row = mapUserToProfileRow(
    createUserRecord({
      id: "user-1",
      email: "a@example.com",
      role: ROLES.REFEREE,
      venueId: "venue-a",
    })
  );
  assert.equal(row.venue_id, "venue-a");
  assert.equal(row.tenant_id, null);
});

test("mapUserToProfileRow persists tenant_id and venue_id independently", () => {
  const row = mapUserToProfileRow(
    createUserRecord({
      id: "user-1",
      email: "a@example.com",
      role: ROLES.REFEREE,
      tenantId: "tenant-a",
      venueId: "venue-home",
    })
  );
  assert.equal(row.tenant_id, "tenant-a");
  assert.equal(row.venue_id, "venue-home");
});

test("mapUserToProfileRow keeps same string as two explicit fields", () => {
  const shared = "scope-same";
  const row = mapUserToProfileRow(
    createUserRecord({
      id: "user-1",
      email: "a@example.com",
      role: ROLES.PLAYER,
      tenantId: shared,
      venueId: shared,
    })
  );
  assert.equal(row.tenant_id, shared);
  assert.equal(row.venue_id, shared);
  assert.ok(Object.prototype.hasOwnProperty.call(row, "tenant_id"));
  assert.ok(Object.prototype.hasOwnProperty.call(row, "venue_id"));
});

test("mapUserToProfileRow never copies venue onto tenant", () => {
  const mapper = PROFILE_SOURCE.slice(
    PROFILE_SOURCE.indexOf("export function mapUserToProfileRow"),
    PROFILE_SOURCE.indexOf("export async function fetchProfileByUserId")
  );
  assert.equal(mapper.includes("normalized.venueId"), true);
  assert.equal(mapper.includes("tenant_id: normalized.venueId"), false);
  const row = mapUserToProfileRow(
    createUserRecord({
      id: "user-1",
      email: "a@example.com",
      venueId: "venue-only",
    })
  );
  assert.equal(row.tenant_id, null);
  assert.equal(row.venue_id, "venue-only");
});

test("self-edit mapping cannot set tenant_id", () => {
  assert.equal(SELF_EDITABLE_PROFILE_FIELDS.includes("tenant_id"), false);
  assert.equal(SELF_EDITABLE_PROFILE_FIELDS.includes("tenantId"), false);
  const patch = mapUserToSelfProfilePatch(
    createUserRecord({
      id: "user-1",
      email: "a@example.com",
      tenantId: "tenant-a",
      venueId: "venue-a",
      displayName: "Patched",
    })
  );
  assert.equal(Object.prototype.hasOwnProperty.call(patch, "tenant_id"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(patch, "venue_id"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(patch, "role"), false);
});

test("canonical profile read keeps tenant_id independent of venue_id", () => {
  const user = mapProfileRowToUser({
    id: "user-1",
    email: "a@example.com",
    display_name: "A",
    role: "REFEREE",
    tenant_id: "tenant-a",
    venue_id: "venue-home",
    status: "active",
  });
  assert.equal(user.tenantId, "tenant-a");
  assert.equal(user.venueId, "venue-home");

  const projected = projectRawIdentitySubjectRecord({
    id: "user-1",
    role: "REFEREE",
    status: "active",
    tenant_id: "tenant-a",
    venue_id: "venue-home",
  });
  assert.equal(authoritativeTenantId(projected), "tenant-a");
  assert.equal(authoritativeVenueId(projected), "venue-home");
  assert.notEqual(authoritativeTenantId(projected), authoritativeVenueId(projected));
});
