/**
 * Identity-owned private persistence read for canonical subject point lookup.
 * Competition adapters must not import this module.
 *
 * Reads only the minimum authoritative raw fields. Does not reuse the
 * legacy login profile projection, which aliases tenant from venue and
 * defaults missing status to ACTIVE.
 */

import { getSupabaseAuthClient, PROFILES_TABLE } from "../../../auth/supabaseClient.js";

export const SUBJECT_IDENTITY_RAW_FIELDS = Object.freeze([
  "id",
  "role",
  "status",
  "tenant_id",
  "venue_id",
  "club_id",
]);

const RAW_SELECT = SUBJECT_IDENTITY_RAW_FIELDS.join(", ");
const RAW_SELECT_WITHOUT_TENANT_COLUMN = "id, role, status, venue_id, club_id";

const FORBIDDEN_PII_FIELDS = Object.freeze([
  "email",
  "phone",
  "display_name",
  "displayName",
  "password",
  "must_change_password",
  "mustChangePassword",
  "avatar_url",
  "avatarUrl",
]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function readRawId(row, keys) {
  for (const key of keys) {
    if (isNonEmptyString(row?.[key])) return String(row[key]).trim();
  }
  return null;
}

function isMissingTenantColumnError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  if (!message.includes("tenant_id")) return false;
  return (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find") ||
    message.includes("column")
  );
}

/**
 * Project a raw profiles row into Identity subject fields.
 * tenantId and venueId stay distinct. Missing tenant_id is null, never venue_id.
 * Status is not defaulted to ACTIVE.
 *
 * @param {object|null|undefined} row
 * @returns {object|null}
 */
export function projectRawIdentitySubjectRecord(row) {
  if (!row || typeof row !== "object") return null;
  const id = readRawId(row, ["id"]);
  if (!id) return null;

  const projected = Object.freeze({
    id,
    role: readRawId(row, ["role"]),
    status: readRawId(row, ["status"]),
    tenantId: readRawId(row, ["tenant_id", "tenantId"]),
    venueId: readRawId(row, ["venue_id", "venueId"]),
    clubId: readRawId(row, ["club_id", "clubId"]),
    organizationId: readRawId(row, ["organization_id", "organizationId"]),
  });

  for (const field of FORBIDDEN_PII_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(projected, field)) return null;
  }
  return projected;
}

/**
 * @param {string} subjectId
 * @param {{
 *   getAuthClient?: () => { from: Function }|null,
 * }} [deps]
 * @returns {Promise<object|null>}
 */
export async function loadIdentitySubjectByIdFromPersistence(subjectId, deps = {}) {
  const id = String(subjectId || "").trim();
  if (!id) return null;

  const getClient =
    typeof deps.getAuthClient === "function" ? deps.getAuthClient : getSupabaseAuthClient;
  const client = getClient();
  if (!client) return null;

  const query = async (select) =>
    client.from(PROFILES_TABLE).select(select).eq("id", id).maybeSingle();

  let { data, error } = await query(RAW_SELECT);
  if (error && isMissingTenantColumnError(error)) {
    ({ data, error } = await query(RAW_SELECT_WITHOUT_TENANT_COLUMN));
  }
  if (error || !data) return null;
  return projectRawIdentitySubjectRecord(data);
}
