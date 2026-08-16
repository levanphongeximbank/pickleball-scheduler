/**
 * In-memory fake for Batch 7 canonical live resource runtime (unit tests).
 * Models occupancy + operational state + resource sessions WITHOUT capacity writes.
 */
import { createHash, randomUUID } from "node:crypto";

import {
  COURT_OCCUPANCY_STATE,
  COURT_OPERATIONAL_STATE,
  LIVE_RUNTIME_CODE,
  RESOURCE_SESSION_SOURCE_TYPE,
  RESOURCE_SESSION_STATUS,
  normalizeOperationalState,
  normalizeSourceType,
  operationalStateAllowsUse,
} from "../../src/features/court-resource/constants/canonicalLiveRuntime.js";

function fingerprint(operation, payload) {
  return createHash("sha256").update(JSON.stringify({ operation, payload })).digest("hex");
}

function liveKey(tenantId, physicalCourtId) {
  return `${tenantId}::${physicalCourtId}`;
}

export function createCanonicalLiveRuntimeFakeStore(seed = {}) {
  const courts = new Map(
    Object.entries(seed.courts || {
      "11111111-1111-4111-8111-111111111111": { tenantId: "tenant-a", displayName: "Court A" },
      "22222222-2222-4222-8222-222222222222": { tenantId: "tenant-a", displayName: "Court B" },
      "33333333-3333-4333-8333-333333333333": { tenantId: "tenant-b", displayName: "Court Foreign" },
    })
  );
  /** Capacity claims are READ-ONLY projections for begin-session validation. */
  const capacityClaims = new Map();
  const liveStates = new Map();
  const sessions = new Map();
  const commands = new Map();
  let authUid = seed.authUid || "user-1";
  let actorTenant = seed.actorTenant || "tenant-a";
  let reservationWriteCount = 0;

  function setActor({ uid = "user-1", tenantId = "tenant-a" } = {}) {
    authUid = uid;
    actorTenant = tenantId;
  }

  function assertAuth(tenantId) {
    if (!authUid) return { ok: false, code: "UNAUTHENTICATED" };
    if (!tenantId) return { ok: false, code: "TENANT_MISMATCH" };
    if (tenantId !== actorTenant) return { ok: false, code: "TENANT_FORBIDDEN" };
    return { ok: true };
  }

  function ensureLiveState(tenantId, physicalCourtId) {
    const key = liveKey(tenantId, physicalCourtId);
    if (!liveStates.has(key)) {
      liveStates.set(key, {
        tenantId,
        physicalCourtId,
        occupancyState: COURT_OCCUPANCY_STATE.FREE,
        operationalState: COURT_OPERATIONAL_STATE.AVAILABLE,
        activeResourceSessionId: null,
        version: 1,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
        reason: "",
      });
    }
    return liveStates.get(key);
  }

  function serializeLive(state, session = null) {
    return {
      tenantId: state.tenantId,
      physicalCourtId: state.physicalCourtId,
      occupancyState: state.occupancyState,
      operationalState: state.operationalState,
      activeResourceSessionId: state.activeResourceSessionId,
      activeSession: session
        ? serializeSession(session)
        : state.activeResourceSessionId
          ? serializeSession(sessions.get(state.activeResourceSessionId))
          : null,
      activeResourceBlock: null,
      version: state.version,
      updatedAt: state.updatedAt,
      reason: state.reason || "",
      identityAuthority: "physicalCourtId",
    };
  }

  function serializeSession(session) {
    if (!session) return null;
    return {
      resourceSessionId: session.resourceSessionId,
      tenantId: session.tenantId,
      physicalCourtId: session.physicalCourtId,
      sourceType: session.sourceType,
      sourceId: session.sourceId,
      reservationRef: session.reservationRef,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      createdBy: session.createdBy,
      identityAuthority: "physicalCourtId",
    };
  }

  function replayOrConflict(tenantId, requestId, operation, fp) {
    const key = `${tenantId}::${requestId}`;
    const existing = commands.get(key);
    if (!existing) return null;
    if (existing.operation !== operation || existing.fingerprint !== fp) {
      return { ok: false, code: "IDEMPOTENCY_CONFLICT" };
    }
    return { ...existing.result, replay: true };
  }

  function storeCommand(tenantId, requestId, operation, fp, result) {
    commands.set(`${tenantId}::${requestId}`, {
      operation,
      fingerprint: fp,
      result,
    });
  }

  function assertCourt(tenantId, physicalCourtId) {
    const court = courts.get(physicalCourtId);
    if (!court) return { ok: false, code: "UNKNOWN_COURT", physicalCourtId };
    if (court.tenantId !== tenantId) {
      return { ok: false, code: "CROSS_TENANT_COURT", physicalCourtId };
    }
    return { ok: true, court };
  }

  function capacityKey(sourceType, sourceId, physicalCourtId) {
    return `${sourceType}::${sourceId}::${physicalCourtId}`;
  }

  function seedCapacityClaim(claim = {}) {
    const row = {
      tenantId: claim.tenantId || "tenant-a",
      physicalCourtId: claim.physicalCourtId,
      sourceType: claim.sourceType || claim.ownerType,
      sourceId: claim.sourceId || claim.ownerId,
      reservationId: claim.reservationId || randomUUID(),
      status: claim.status || "active",
    };
    capacityClaims.set(
      capacityKey(row.sourceType, row.sourceId, row.physicalCourtId),
      row
    );
    return row;
  }

  function hasValidCapacityClaim(tenantId, physicalCourtId, sourceType, sourceId) {
    const claim = capacityClaims.get(capacityKey(sourceType, sourceId, physicalCourtId));
    if (!claim) return false;
    return (
      claim.tenantId === tenantId
      && claim.status === "active"
      && claim.physicalCourtId === physicalCourtId
    );
  }

  function beginSession(args = {}) {
    const tenantId = String(args.p_tenant_id || "").trim();
    const physicalCourtId = String(args.p_physical_court_id || "").trim();
    const sourceType = normalizeSourceType(args.p_source_type);
    const sourceId = String(args.p_source_id || "").trim();
    const requestId = String(args.p_request_id || "").trim();
    const reservationRef = args.p_reservation_ref || null;
    const operationsAuthorized = args.p_operations_authorized === true;
    const capacityClaimValid = args.p_capacity_claim_valid === true;
    const actorId = args.p_actor_id || authUid;

    const auth = assertAuth(tenantId);
    if (!auth.ok) return auth;
    if (!requestId) return { ok: false, code: "REQUEST_ID_REQUIRED" };
    if (!sourceType || !sourceId) {
      return { ok: false, code: "INVALID_INPUT", message: "sourceType and sourceId are required." };
    }

    const payload = {
      tenantId,
      physicalCourtId,
      sourceType,
      sourceId,
      reservationRef,
      operationsAuthorized,
    };
    const fp = fingerprint("begin", payload);
    const replay = replayOrConflict(tenantId, requestId, "begin", fp);
    if (replay) return replay;

    const courtOk = assertCourt(tenantId, physicalCourtId);
    if (!courtOk.ok) return courtOk;

    const state = ensureLiveState(tenantId, physicalCourtId);
    if (!operationalStateAllowsUse(state.operationalState)) {
      return {
        ok: false,
        code: LIVE_RUNTIME_CODE.OPERATIONAL_STATE_DENIES_USE,
        message: "Current operational state does not allow starting a live session.",
        operationalState: state.operationalState,
      };
    }

    if (sourceType === RESOURCE_SESSION_SOURCE_TYPE.OPERATIONS) {
      if (!operationsAuthorized) {
        return {
          ok: false,
          code: LIVE_RUNTIME_CODE.OPERATIONS_POLICY_REQUIRED,
          message: "Operations live use requires explicit Court Operations authorization.",
        };
      }
    } else {
      const claimOk =
        capacityClaimValid
        || hasValidCapacityClaim(tenantId, physicalCourtId, sourceType, sourceId);
      if (!claimOk) {
        return {
          ok: false,
          code: LIVE_RUNTIME_CODE.CAPACITY_CLAIM_REQUIRED,
          message: "beginResourceSession requires a valid capacity claim for this source.",
        };
      }
    }

    if (state.activeResourceSessionId) {
      const active = sessions.get(state.activeResourceSessionId);
      if (
        active
        && active.status === RESOURCE_SESSION_STATUS.ACTIVE
        && active.sourceType === sourceType
        && active.sourceId === sourceId
      ) {
        const result = {
          ok: true,
          code: LIVE_RUNTIME_CODE.OK,
          replay: true,
          liveState: serializeLive(state, active),
          resourceSession: serializeSession(active),
          reservationWriteCount: 0,
        };
        storeCommand(tenantId, requestId, "begin", fp, result);
        return result;
      }
      return {
        ok: false,
        code: LIVE_RUNTIME_CODE.SESSION_ACTIVE_CONFLICT,
        message: "Physical court already has an active resource session.",
        activeResourceSessionId: state.activeResourceSessionId,
      };
    }

    const session = {
      resourceSessionId: randomUUID(),
      tenantId,
      physicalCourtId,
      sourceType,
      sourceId,
      reservationRef,
      status: RESOURCE_SESSION_STATUS.ACTIVE,
      startedAt: new Date().toISOString(),
      endedAt: null,
      createdBy: actorId,
    };
    sessions.set(session.resourceSessionId, session);
    state.occupancyState = COURT_OCCUPANCY_STATE.OCCUPIED;
    state.activeResourceSessionId = session.resourceSessionId;
    state.version += 1;
    state.updatedAt = new Date().toISOString();
    state.updatedBy = actorId;

    const result = {
      ok: true,
      code: LIVE_RUNTIME_CODE.OK,
      liveState: serializeLive(state, session),
      resourceSession: serializeSession(session),
      reservationWriteCount: 0,
    };
    storeCommand(tenantId, requestId, "begin", fp, result);
    return result;
  }

  function endSession(args = {}) {
    const tenantId = String(args.p_tenant_id || "").trim();
    const requestId = String(args.p_request_id || "").trim();
    const physicalCourtId = args.p_physical_court_id
      ? String(args.p_physical_court_id).trim()
      : "";
    const resourceSessionId = args.p_resource_session_id
      ? String(args.p_resource_session_id).trim()
      : "";
    const sourceType = normalizeSourceType(args.p_source_type);
    const sourceId = args.p_source_id ? String(args.p_source_id).trim() : "";
    const actorId = args.p_actor_id || authUid;

    const auth = assertAuth(tenantId);
    if (!auth.ok) return auth;
    if (!requestId) return { ok: false, code: "REQUEST_ID_REQUIRED" };

    const payload = {
      tenantId,
      physicalCourtId,
      resourceSessionId,
      sourceType,
      sourceId,
    };
    const fp = fingerprint("end", payload);
    const replay = replayOrConflict(tenantId, requestId, "end", fp);
    if (replay) return replay;

    let session = null;
    if (resourceSessionId) {
      session = sessions.get(resourceSessionId) || null;
    } else if (physicalCourtId) {
      const state = ensureLiveState(tenantId, physicalCourtId);
      session = state.activeResourceSessionId
        ? sessions.get(state.activeResourceSessionId)
        : null;
      if (!session && sourceType && sourceId) {
        session =
          [...sessions.values()].find(
            (row) =>
              row.tenantId === tenantId
              && row.physicalCourtId === physicalCourtId
              && row.sourceType === sourceType
              && row.sourceId === sourceId
              && row.status === RESOURCE_SESSION_STATUS.ACTIVE
          ) || null;
      }
    }

    if (!session || session.tenantId !== tenantId) {
      const emptyState = physicalCourtId
        ? ensureLiveState(tenantId, physicalCourtId)
        : null;
      const result = {
        ok: true,
        code: LIVE_RUNTIME_CODE.OK,
        replay: true,
        liveState: emptyState ? serializeLive(emptyState) : null,
        resourceSession: null,
        reservationWriteCount: 0,
        reservationReleased: false,
      };
      storeCommand(tenantId, requestId, "end", fp, result);
      return result;
    }

    if (sourceType && sourceId) {
      if (session.sourceType !== sourceType || session.sourceId !== sourceId) {
        return {
          ok: false,
          code: LIVE_RUNTIME_CODE.SESSION_SOURCE_MISMATCH,
          message: "End session source does not own the active session.",
        };
      }
    }

    if (session.status === RESOURCE_SESSION_STATUS.ENDED) {
      const state = ensureLiveState(tenantId, session.physicalCourtId);
      const result = {
        ok: true,
        code: LIVE_RUNTIME_CODE.OK,
        replay: true,
        liveState: serializeLive(state),
        resourceSession: serializeSession(session),
        reservationWriteCount: 0,
        reservationReleased: false,
      };
      storeCommand(tenantId, requestId, "end", fp, result);
      return result;
    }

    session.status = RESOURCE_SESSION_STATUS.ENDED;
    session.endedAt = new Date().toISOString();
    const state = ensureLiveState(tenantId, session.physicalCourtId);
    if (state.activeResourceSessionId === session.resourceSessionId) {
      state.activeResourceSessionId = null;
      state.occupancyState = COURT_OCCUPANCY_STATE.FREE;
      state.version += 1;
      state.updatedAt = new Date().toISOString();
      state.updatedBy = actorId;
    }

    const result = {
      ok: true,
      code: LIVE_RUNTIME_CODE.OK,
      liveState: serializeLive(state),
      resourceSession: serializeSession(session),
      reservationWriteCount: 0,
      reservationReleased: false,
    };
    storeCommand(tenantId, requestId, "end", fp, result);
    return result;
  }

  function setOperationalState(args = {}) {
    const tenantId = String(args.p_tenant_id || "").trim();
    const physicalCourtId = String(args.p_physical_court_id || "").trim();
    const operationalState = normalizeOperationalState(args.p_operational_state);
    const reason = String(args.p_reason || "");
    const requestId = String(args.p_request_id || "").trim();
    const actorId = args.p_actor_id || authUid;

    const auth = assertAuth(tenantId);
    if (!auth.ok) return auth;
    if (!requestId) return { ok: false, code: "REQUEST_ID_REQUIRED" };
    if (!operationalState) {
      return { ok: false, code: LIVE_RUNTIME_CODE.INVALID_OPERATIONAL_STATE };
    }

    const payload = { tenantId, physicalCourtId, operationalState, reason };
    const fp = fingerprint("set_operational_state", payload);
    const replay = replayOrConflict(tenantId, requestId, "set_operational_state", fp);
    if (replay) return replay;

    const courtOk = assertCourt(tenantId, physicalCourtId);
    if (!courtOk.ok) return courtOk;

    const state = ensureLiveState(tenantId, physicalCourtId);
    state.operationalState = operationalState;
    state.reason = reason;
    state.version += 1;
    state.updatedAt = new Date().toISOString();
    state.updatedBy = actorId;

    const result = {
      ok: true,
      code: LIVE_RUNTIME_CODE.OK,
      liveState: serializeLive(state),
      resourceBlockCreated: false,
      reservationCreated: false,
      reservationWriteCount: 0,
    };
    storeCommand(tenantId, requestId, "set_operational_state", fp, result);
    return result;
  }

  function getState(args = {}) {
    const tenantId = String(args.p_tenant_id || "").trim();
    const physicalCourtId = String(args.p_physical_court_id || "").trim();
    const auth = assertAuth(tenantId);
    if (!auth.ok) return auth;
    const courtOk = assertCourt(tenantId, physicalCourtId);
    if (!courtOk.ok) return courtOk;
    const state = ensureLiveState(tenantId, physicalCourtId);
    return {
      ok: true,
      code: LIVE_RUNTIME_CODE.OK,
      liveState: serializeLive(state),
    };
  }

  function listSessions(args = {}) {
    const tenantId = String(args.p_tenant_id || "").trim();
    const auth = assertAuth(tenantId);
    if (!auth.ok) return { ...auth, sessions: [] };
    const physicalCourtId = args.p_physical_court_id
      ? String(args.p_physical_court_id).trim()
      : "";
    const status = args.p_status ? String(args.p_status).trim() : "";
    const rows = [...sessions.values()].filter((row) => {
      if (row.tenantId !== tenantId) return false;
      if (physicalCourtId && row.physicalCourtId !== physicalCourtId) return false;
      if (status && row.status !== status) return false;
      return true;
    });
    return {
      ok: true,
      code: LIVE_RUNTIME_CODE.OK,
      sessions: rows.map(serializeSession),
    };
  }

  return {
    setActor,
    seedCapacityClaim,
    renameCourtDisplayName(physicalCourtId, displayName) {
      const court = courts.get(physicalCourtId);
      if (court) court.displayName = displayName;
    },
    getReservationWriteCount: () => reservationWriteCount,
    /** Explicitly count attempted reservation writes — must stay 0. */
    attemptReservationWrite() {
      reservationWriteCount += 1;
      throw new Error("Live runtime must not write reservations.");
    },
    liveStates,
    sessions,
    capacityClaims,
    courts,
    rpcClient() {
      return {
        rpc: async (name, args) => {
          try {
            if (name === "court_operations_live_begin_resource_session") {
              return { data: beginSession(args), error: null };
            }
            if (name === "court_operations_live_end_resource_session") {
              return { data: endSession(args), error: null };
            }
            if (name === "court_operations_live_set_operational_state") {
              return { data: setOperationalState(args), error: null };
            }
            if (name === "court_operations_live_get_court_state") {
              return { data: getState(args), error: null };
            }
            if (name === "court_operations_live_list_resource_sessions") {
              return { data: listSessions(args), error: null };
            }
            return {
              data: null,
              error: { message: `Unknown RPC ${name}`, code: "PGRST202" },
            };
          } catch (error) {
            return { data: null, error: { message: error.message } };
          }
        },
      };
    },
  };
}
