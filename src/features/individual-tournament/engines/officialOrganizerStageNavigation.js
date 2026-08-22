/**
 * Official Organizer workflow navigation — URL query is the view-state authority.
 * Canonical tournament data remains the business-lifecycle authority.
 * Does not persist selected stage into the tournament payload.
 */

import {
  OFFICIAL_STAGE_ID,
  OFFICIAL_STAGE_STATE,
} from "./officialOrganizerWorkflowEngine.js";

export const OFFICIAL_STAGE_QUERY_KEY = "stage";

const BASE_STAGE_ORDER = [
  OFFICIAL_STAGE_ID.SETTINGS,
  OFFICIAL_STAGE_ID.REGISTRATION,
  OFFICIAL_STAGE_ID.LOCK_ENTRIES,
  OFFICIAL_STAGE_ID.DRAW,
  OFFICIAL_STAGE_ID.GROUP_STAGE,
  OFFICIAL_STAGE_ID.RESULTS,
];

export function readOfficialStageQuery(searchParams) {
  if (!searchParams || typeof searchParams.get !== "function") {
    return "";
  }
  return String(searchParams.get(OFFICIAL_STAGE_QUERY_KEY) || "").trim();
}

export function applyOfficialStageSearchParams(searchParams, stageId) {
  const next = new URLSearchParams(
    searchParams && typeof searchParams.forEach === "function"
      ? searchParams
      : String(searchParams || "")
  );
  const id = String(stageId || "").trim();
  if (id) {
    next.set(OFFICIAL_STAGE_QUERY_KEY, id);
  } else {
    next.delete(OFFICIAL_STAGE_QUERY_KEY);
  }
  return next;
}

function stageIds(stages = []) {
  return (Array.isArray(stages) ? stages : [])
    .map((stage) => String(stage?.id || "").trim())
    .filter(Boolean);
}

function nearestOfficialStageId(requestedStageId, stages, lifecycleCurrentStageId) {
  const ids = stageIds(stages);
  const idSet = new Set(ids);
  const requested = String(requestedStageId || "").trim();

  if (requested && idSet.has(requested)) {
    return requested;
  }

  if (requested.startsWith("knockout:")) {
    const knockout = ids.find((id) => id.startsWith("knockout:") && id !== "knockout:pending");
    if (knockout) return knockout;
    if (idSet.has(OFFICIAL_STAGE_ID.RESULTS)) return OFFICIAL_STAGE_ID.RESULTS;
  }

  const requestedIndex = BASE_STAGE_ORDER.indexOf(requested);
  if (requestedIndex >= 0) {
    for (let offset = 0; offset < BASE_STAGE_ORDER.length; offset += 1) {
      const backward = BASE_STAGE_ORDER[requestedIndex - offset];
      if (backward && idSet.has(backward)) return backward;
      const forward = BASE_STAGE_ORDER[requestedIndex + offset];
      if (forward && idSet.has(forward)) return forward;
    }
  }

  if (lifecycleCurrentStageId && idSet.has(lifecycleCurrentStageId)) {
    return lifecycleCurrentStageId;
  }
  return ids[0] || OFFICIAL_STAGE_ID.SETTINGS;
}

/**
 * Resolve the Organizer workspace stage from URL vs lifecycle projection.
 * Invalid/stale query → nearest valid stage (may normalize URL).
 * Locked future stages remain selectable as navigation (not permission).
 */
export function resolveOfficialOrganizerStageSelection({
  requestedStageId = "",
  stages = [],
  lifecycleCurrentStageId = "",
} = {}) {
  const ids = stageIds(stages);
  const idSet = new Set(ids);
  const requested = String(requestedStageId || "").trim();
  const fallback =
    (lifecycleCurrentStageId && idSet.has(lifecycleCurrentStageId)
      ? lifecycleCurrentStageId
      : ids[0]) || OFFICIAL_STAGE_ID.SETTINGS;

  if (!requested) {
    return {
      stageId: fallback,
      source: "lifecycle",
      valid: true,
      normalized: false,
      locked: false,
    };
  }

  if (idSet.has(requested)) {
    const stage = (stages || []).find((item) => String(item?.id) === requested);
    const state = String(stage?.state || "");
    const locked =
      state === OFFICIAL_STAGE_STATE.BLOCKED ||
      state === OFFICIAL_STAGE_STATE.PENDING;
    return {
      stageId: requested,
      source: "url",
      valid: true,
      normalized: false,
      locked,
    };
  }

  const nearest = nearestOfficialStageId(requested, stages, fallback);
  return {
    stageId: nearest,
    source: "fallback",
    valid: false,
    normalized: true,
    locked: false,
  };
}
