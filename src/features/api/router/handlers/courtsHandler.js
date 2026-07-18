import { API_SCOPES } from "../../constants/apiScopes.js";
import { API_ERROR_CODES } from "../../constants/apiErrors.js";
import { listCourts } from "../../../venue-court/index.js";
import {
  hydrateApiClubScope,
  assertClubInScope,
  resolveAllowedClubIds,
} from "../../services/clubScopeService.js";

const defaultDeps = Object.freeze({
  listCourts,
  hydrateApiClubScope,
  assertClubInScope,
  resolveAllowedClubIds,
});

let deps = { ...defaultDeps };

/** @internal Test-only dependency override. */
export function __setCourtsHandlerDepsForTests(nextDeps = {}) {
  deps = { ...defaultDeps, ...nextDeps };
}

/** @internal Test-only dependency reset. */
export function __resetCourtsHandlerDepsForTests() {
  deps = { ...defaultDeps };
}

function createClubRequiredError() {
  return Object.assign(new Error("Thiếu clubId."), {
    statusCode: 400,
    code: API_ERROR_CODES.CLUB_REQUIRED,
  });
}

/**
 * Courts-handler-local club resolution.
 *
 * Does NOT use resolveScopedClubId auto-pick of the first allowed club.
 *
 * | clubId query | Allowed clubs | Result |
 * | valid        | any           | that club |
 * | unauthorized | any           | 403 (assertClubInScope) |
 * | missing      | 1             | sole allowed club |
 * | missing      | >1            | 400 CLUB_REQUIRED |
 * | missing      | 0             | null → empty list |
 */
export function resolveCourtsHandlerClubId(ctx) {
  const raw = ctx?.query?.clubId;
  const requested = raw != null && String(raw).trim() !== "" ? String(raw).trim() : null;

  if (requested) {
    return deps.assertClubInScope(requested, ctx);
  }

  const allowed = deps.resolveAllowedClubIds({
    tenantId: ctx?.auth?.tenantId,
    user: ctx?.auth?.user,
  });
  const allowedIds = [...allowed];

  if (allowedIds.length === 0) {
    return null;
  }

  if (allowedIds.length === 1) {
    return allowedIds[0];
  }

  throw createClubRequiredError();
}

/**
 * GET /courts — Court Inventory via Venue & Court facade (Club V3 SSOT).
 *
 * Response contract (preserved):
 * { items: [{ id, name, number, active }], total, clubId }
 */
export async function handleCourtsList(ctx) {
  await deps.hydrateApiClubScope(ctx);
  const clubId = resolveCourtsHandlerClubId(ctx);

  if (!clubId) {
    return { items: [], total: 0 };
  }

  const tenantId = ctx.auth?.tenantId || null;

  let courts;
  try {
    // includeInactive: true — legacy handler did not filter active; preserve that contract.
    courts = deps.listCourts({
      clubId,
      tenantId,
      includeInactive: true,
    });
  } catch (error) {
    throw Object.assign(new Error(error?.message || "Failed to load courts"), {
      statusCode: error?.statusCode || 500,
      code: error?.code,
      cause: error,
    });
  }

  const items = (courts || []).map((c) => ({
    id: c.id,
    name: c.name,
    number: c.number,
    active: c.active,
  }));

  return {
    items,
    total: items.length,
    clubId,
  };
}

export const courtsRoutes = [
  {
    method: "GET",
    path: "/courts",
    scope: API_SCOPES.COURTS_READ,
    handler: handleCourtsList,
  },
];
