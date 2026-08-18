/**
 * Trusted-server match-execution initialization.
 *
 * Browser may supply only tournamentId, matchId, competitionMode, idempotencyKey.
 * Actor, role, tenant, Adapter B, and initial state are resolved server-side.
 *
 * Authorization reuses Identity subject lookup + CORE-02 evaluateAuthorization
 * with E2E-03 organizer.operations.prepare (tournament.update). Not a private
 * role checker. Venue is never tenant.
 */

import { evaluateAuthorization } from "../../competition-core/role-permission/index.js";
import { createIdentityEvidenceFromIdentityAdapter } from "../../competition-engine/integration/adapters/identityEvidenceFromIdentityAdapter.js";
import { ORGANIZER_ACTION } from "../../competition-engine/operations/constants.js";
import { resolveOrganizerActionPermissions } from "../../competition-engine/operations/permissions/organizerActionMap.js";
import { normalizeRole, ROLES } from "../../identity/constants/roles.js";
import {
  resolveSubjectIdentityRecord,
  SUBJECT_IDENTITY_LOOKUP_CODE,
} from "../../identity/services/subjectIdentityLookupService.js";
import { loadIdentitySubjectByIdFromPersistence } from "../../identity/services/subjectIdentityPersistence.js";
import { initializeMatchExecutionState } from "../execution/initializeMatchExecutionState.js";
import { MATCH_EXECUTION_INIT_RPC } from "../execution/matchExecutionInitPolicy.js";
import { REFEREE_V5_ERROR, createPersistenceError } from "../persistence/errors.js";
import {
  createServerResolvedAdapterB,
  mapCanonicalIdentityToAdapterBModeState,
} from "./mapCanonicalIdentityToAdapterBModeState.js";

export const TRUSTED_INIT_ACTION = "initialize-execution";

export const TRUSTED_INIT_CLIENT_FIELDS = Object.freeze([
  "action",
  "tournamentId",
  "matchId",
  "competitionMode",
  "idempotencyKey",
]);

export const TRUSTED_INIT_REJECTED_FIELDS = Object.freeze([
  "actor",
  "actorId",
  "actor_id",
  "userId",
  "user_id",
  "role",
  "actorRole",
  "tenantRole",
  "trustedActor",
  "tenantId",
  "tenant_id",
  "initialState",
  "statePayload",
  "stateSnapshot",
  "serviceRoleKey",
  "adapter",
  "modeState",
  "adapterRequest",
  "grantedPermissions",
]);

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function stripClientAuthorityFields(body = {}) {
  const source = isPlainObject(body) ? body : {};
  const ignored = TRUSTED_INIT_REJECTED_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(source, field)
  );
  return {
    tournamentId: text(source.tournamentId),
    matchId: text(source.matchId),
    competitionMode: text(source.competitionMode).toUpperCase(),
    idempotencyKey: text(source.idempotencyKey),
    ignored,
  };
}

export function createTrustedServerIdentityLoader(serviceClient) {
  return function loadIdentitySubjectById(subjectId) {
    return loadIdentitySubjectByIdFromPersistence(subjectId, {
      getAuthClient: () => serviceClient,
    });
  };
}

export async function loadCanonicalTournamentForInit(serviceClient, tournamentId) {
  if (!serviceClient || typeof serviceClient.from !== "function") {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      "Trusted-server service client is required."
    );
  }
  const id = text(tournamentId);
  if (!id) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "tournamentId is required."
    );
  }
  const { data, error } = await serviceClient
    .from("canonical_tournaments")
    .select("id, tenant_id, club_id, mode, status, payload, engine_v4, name")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return createPersistenceError(REFEREE_V5_ERROR.NOT_CONFIGURED, error.message);
  }
  if (!data || text(data.id) !== id) {
    return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
  }
  if (!text(data.tenant_id)) {
    return createPersistenceError(
      REFEREE_V5_ERROR.TENANT_ACCESS_DENIED,
      "Tournament tenant evidence is missing."
    );
  }
  return { ok: true, row: data, tenantId: text(data.tenant_id) };
}

function mapIdentityLookupFailure(result) {
  const code = result?.code;
  if (
    code === SUBJECT_IDENTITY_LOOKUP_CODE.SCOPE_MISMATCH ||
    code === SUBJECT_IDENTITY_LOOKUP_CODE.MISSING_SCOPE_EVIDENCE
  ) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  }
  return createPersistenceError(
    REFEREE_V5_ERROR.TENANT_ACCESS_DENIED,
    "Canonical identity evidence is unavailable."
  );
}

function trustedInitActorRole(identityRole) {
  const role = normalizeRole(identityRole);
  if (role === ROLES.PLATFORM_ADMIN) return "SUPER_ADMIN";
  return "ORGANIZER";
}

export function sanitizeTrustedInitResult(result) {
  if (!result?.ok) return result;
  return {
    ok: true,
    initialized: result.initialized === true,
    alreadyInitialized: result.alreadyInitialized === true,
    duplicate: result.duplicate === true,
    reset: false,
    matchId: result.matchId,
    tournamentId: result.tournamentId,
    tenantId: result.tenantId,
    status: result.status,
    stateVersion: result.stateVersion,
    lastEventSequence: result.lastEventSequence,
    state: result.state,
  };
}

export async function processTrustedMatchExecutionInit({
  body,
  verifiedUserId,
  serviceClient,
  ports = {},
}) {
  const request = stripClientAuthorityFields(body);
  if (!text(verifiedUserId)) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  }
  if (!request.tournamentId || !request.matchId) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "tournamentId and matchId are required."
    );
  }
  if (!request.idempotencyKey) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "idempotencyKey is required."
    );
  }
  if (!serviceClient || typeof serviceClient.rpc !== "function") {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      "Only the trusted-server service client may persist initialization."
    );
  }

  const loadTournament =
    typeof ports.loadCanonicalTournament === "function"
      ? ports.loadCanonicalTournament
      : (id) => loadCanonicalTournamentForInit(serviceClient, id);
  const loaded = await loadTournament(request.tournamentId);
  if (!loaded?.ok) return loaded;

  const mapped = mapCanonicalIdentityToAdapterBModeState(loaded.row);
  if (!mapped.ok) return mapped;

  if (
    request.competitionMode &&
    request.competitionMode !== mapped.competitionMode
  ) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "competitionMode does not match canonical tournament identity."
    );
  }

  const loadIdentitySubjectById =
    typeof ports.loadIdentitySubjectById === "function"
      ? ports.loadIdentitySubjectById
      : createTrustedServerIdentityLoader(serviceClient);

  const identity = await resolveSubjectIdentityRecord(
    {
      subjectId: String(verifiedUserId).trim(),
      requestedTenantId: mapped.tenantId,
    },
    { loadIdentitySubjectById }
  );
  if (!identity.ok) {
    return mapIdentityLookupFailure(identity);
  }

  const organizerMapping = resolveOrganizerActionPermissions(
    ORGANIZER_ACTION.PREPARE_OPERATIONS
  );
  const evidencePort =
    ports.identityEvidencePort ||
    createIdentityEvidenceFromIdentityAdapter({ loadIdentitySubjectById });
  const decision = await evaluateAuthorization(
    {
      subject: {
        actorId: identity.evidence.subjectId,
        role: identity.evidence.role,
      },
      scope: {
        tenantId: mapped.tenantId,
        competitionId: request.tournamentId,
      },
      action: ORGANIZER_ACTION.PREPARE_OPERATIONS,
      requiredPermissions: [...organizerMapping.requiredPermissions],
    },
    { evidencePort }
  );

  if (!decision || decision.allowed !== true) {
    const denyCode = String(decision?.denyReason || decision?.decisionCode || "");
    if (/CROSS_TENANT|SCOPE_MISMATCH/i.test(denyCode)) {
      return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
    }
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      decision?.reason || "Organizer initialization is not authorized."
    );
  }

  const adapter =
    typeof ports.createAdapter === "function"
      ? ports.createAdapter(mapped.competitionMode, mapped.modeState)
      : createServerResolvedAdapterB(mapped.competitionMode, mapped.modeState);
  if (!adapter) {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      "Canonical Adapter B could not be resolved server-side."
    );
  }

  const init = ports.initializeMatchExecutionState || initializeMatchExecutionState;
  const result = await init({
    tenantId: mapped.tenantId,
    tournamentId: request.tournamentId,
    matchId: request.matchId,
    competitionMode: mapped.competitionMode,
    idempotencyKey: request.idempotencyKey,
    actor: {
      actorId: identity.evidence.subjectId,
      role: trustedInitActorRole(identity.evidence.role),
      tenantId: mapped.tenantId,
    },
    adapter,
    rpcClient: serviceClient,
  });

  return result?.ok ? sanitizeTrustedInitResult(result) : result;
}

export { MATCH_EXECUTION_INIT_RPC };
