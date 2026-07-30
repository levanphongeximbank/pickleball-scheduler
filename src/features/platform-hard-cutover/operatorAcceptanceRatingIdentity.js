/**
 * A-RATE durable identity: verify two distinct start-assessment rows
 * belong to the current session user + tenant. No profile required.
 */

export function resolveRatingAssessmentId(result) {
  return String(
    result?.assessmentId ||
      result?.assessment_id ||
      result?.data?.assessmentId ||
      result?.data?.assessment_id ||
      ""
  ).trim();
}

/**
 * Pure evaluator — unit-tested with mock RPC/table payloads.
 * @returns {{ ok: boolean, code?: string, message?: string, details?: object }}
 */
export function evaluateRatingAssessmentIdentity({
  sessionUserId,
  tenantId,
  firstAssessmentId,
  secondAssessmentId,
  rows,
  readError = null,
} = {}) {
  const session = String(sessionUserId || "").trim();
  const tenant = String(tenantId || "").trim();
  const firstId = String(firstAssessmentId || "").trim();
  const secondId = String(secondAssessmentId || "").trim();

  if (!session || !tenant) {
    return {
      ok: false,
      code: "RATING_PROFILE_MISMATCH",
      message: "sessionUserId and tenantId are required for rating identity",
      details: { samePlayer: false, sameTenant: false, assessmentRows: 0 },
    };
  }

  if (!firstId || !secondId) {
    return {
      ok: false,
      code: "RATING_PROFILE_MISMATCH",
      message: "Both assessment IDs must be present",
      details: { samePlayer: false, sameTenant: false, assessmentRows: 0 },
    };
  }

  if (firstId === secondId) {
    return {
      ok: false,
      code: "RATING_PROFILE_MISMATCH",
      message: "Assessment IDs must be distinct",
      details: { samePlayer: false, sameTenant: false, assessmentRows: 0 },
    };
  }

  if (readError) {
    return {
      ok: false,
      code: "RATING_PROFILE_MISMATCH",
      message: String(readError),
      details: { samePlayer: false, sameTenant: false, assessmentRows: 0 },
    };
  }

  if (!Array.isArray(rows)) {
    return {
      ok: false,
      code: "RATING_PROFILE_MISMATCH",
      message: "Assessment row read returned no array",
      details: { samePlayer: false, sameTenant: false, assessmentRows: 0 },
    };
  }

  if (rows.length !== 2) {
    return {
      ok: false,
      code: "RATING_PROFILE_MISMATCH",
      message: "Expected exactly 2 assessment rows",
      details: {
        samePlayer: false,
        sameTenant: false,
        assessmentRows: rows.length,
      },
    };
  }

  const byId = new Map(
    rows.map((row) => [String(row?.id || "").trim(), row]).filter(([id]) => id)
  );
  if (!byId.has(firstId) || !byId.has(secondId)) {
    return {
      ok: false,
      code: "RATING_PROFILE_MISMATCH",
      message: "Assessment rows do not match RPC assessment IDs",
      details: {
        samePlayer: false,
        sameTenant: false,
        assessmentRows: rows.length,
      },
    };
  }

  for (const id of [firstId, secondId]) {
    const row = byId.get(id);
    const playerId = String(row?.player_id || "").trim();
    const rowTenant = String(row?.tenant_id || "").trim();
    if (playerId !== session) {
      return {
        ok: false,
        code: "RATING_PROFILE_MISMATCH",
        message: "Assessment player_id does not match session user",
        details: {
          samePlayer: false,
          sameTenant: rowTenant === tenant,
          assessmentRows: rows.length,
        },
      };
    }
    if (rowTenant !== tenant) {
      return {
        ok: false,
        code: "RATING_PROFILE_MISMATCH",
        message: "Assessment tenant_id does not match acceptance tenant",
        details: {
          samePlayer: true,
          sameTenant: false,
          assessmentRows: rows.length,
        },
      };
    }
  }

  return {
    ok: true,
    code: "OK",
    details: {
      samePlayer: true,
      sameTenant: true,
      assessmentRows: 2,
    },
  };
}
