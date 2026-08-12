/**
 * Shared dirty/rebase contract for Team Tournament setup forms.
 *
 * Pristine: server refresh may hydrate.
 * Dirty: background polling / identity-changing teamData MUST NOT clobber local edits.
 * After successful save/readback: accept server as new baseline.
 * Server changed while dirty: retain local and surface conflict (caller UX).
 */

export const SETUP_FORM_REHYDRATE_REASON = Object.freeze({
  FORCE: "force",
  POST_MUTATION_READBACK: "post_mutation_readback",
  INITIAL_HYDRATE: "initial_hydrate",
  SERVER_UNCHANGED: "server_unchanged",
  DIRTY_RETAIN: "dirty_retain_local_server_changed",
  SERVER_CHANGED: "server_changed",
  MISSING_FINGERPRINT: "missing_fingerprint",
});

function stableJson(value) {
  if (value == null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * @param {{
 *   dirty?: boolean,
 *   prevFingerprint?: string|null,
 *   nextFingerprint?: string,
 *   force?: boolean,
 *   afterSuccessfulMutation?: boolean,
 * }} input
 * @returns {{ rehydrate: boolean, reason: string, conflict: boolean }}
 */
export function decideSetupFormRehydration({
  dirty = false,
  prevFingerprint = null,
  nextFingerprint = "",
  force = false,
  afterSuccessfulMutation = false,
} = {}) {
  if (force || afterSuccessfulMutation) {
    return {
      rehydrate: true,
      reason: afterSuccessfulMutation
        ? SETUP_FORM_REHYDRATE_REASON.POST_MUTATION_READBACK
        : SETUP_FORM_REHYDRATE_REASON.FORCE,
      conflict: false,
    };
  }

  if (!nextFingerprint) {
    return {
      rehydrate: false,
      reason: SETUP_FORM_REHYDRATE_REASON.MISSING_FINGERPRINT,
      conflict: false,
    };
  }

  if (prevFingerprint == null) {
    return {
      rehydrate: true,
      reason: SETUP_FORM_REHYDRATE_REASON.INITIAL_HYDRATE,
      conflict: false,
    };
  }

  if (prevFingerprint === nextFingerprint) {
    return {
      rehydrate: false,
      reason: SETUP_FORM_REHYDRATE_REASON.SERVER_UNCHANGED,
      conflict: false,
    };
  }

  if (dirty) {
    return {
      rehydrate: false,
      reason: SETUP_FORM_REHYDRATE_REASON.DIRTY_RETAIN,
      conflict: true,
    };
  }

  return {
    rehydrate: true,
    reason: SETUP_FORM_REHYDRATE_REASON.SERVER_CHANGED,
    conflict: false,
  };
}

export function buildFormatVenueFingerprint(defaults = {}) {
  return stableJson({
    formatPreset: defaults.formatPreset || "",
    rosterRules: defaults.rosterRules || {},
    dreambreakerEnabled: defaults.dreambreakerEnabled === true,
    groupMode: defaults.groupMode || "",
    groupCount: Number(defaults.groupCount) || 0,
    qualificationCount: Number(defaults.qualificationCount) || 0,
    knockoutFormat: defaults.knockoutFormat || "",
    selectedCourtIds: [...(defaults.selectedCourtIds || [])].map(String).sort(),
    stageTieBreakPolicy: defaults.stageTieBreakPolicy || {},
    stageScoringPolicy: defaults.stageScoringPolicy || {},
  });
}

export function buildTiebreakOrderFingerprint(order = []) {
  return stableJson(Array.isArray(order) ? order : []);
}
