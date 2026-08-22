/**
 * Official knockout generation / regeneration guards (UI preview only).
 * Canonical persist is official_open_generate_knockout — do not client-write the bracket.
 *
 * G2-C/D: qualification readiness (totalQualifiers + wildcard fail-closed).
 * G2-E: Content knockoutEnabled / size / pairingPolicy / avoidSameGroupFirstRound
 * constrain existing generateKnockoutBracket / buildFirstKnockoutRound.
 * G2-F1: canonical admission policy/plan via Official bridge (no second engine).
 */

import {
  generateKnockoutBracket,
  hasBracketGenerated,
  isGroupStageComplete,
} from "../../../tournament/engines/bracketEngine.js";
import { MATCH_STATUS } from "../../../models/tournament/constants.js";
import {
  resolveOfficialQualificationReadiness,
  QUALIFICATION_TIE_UNRESOLVED,
  QUALIFICATION_NOT_READY,
} from "./officialStandingsEngine.js";
import {
  assertOfficialKnockoutFirstRoundIntegrity,
  resolveContentKnockoutRuntimeGate,
  CONTENT_KNOCKOUT_PAIRING_POLICY,
} from "./officialContentCompetitionRules.js";
import { resolveOfficialContentKnockoutAdmission } from "./officialKnockoutAdmissionBridge.js";

export function officialKnockoutHasStarted(event) {
  return (event?.matches || []).some(
    (match) =>
      match?.bracketMatchId &&
      (match.status === MATCH_STATUS.COMPLETED ||
        match.status === MATCH_STATUS.FORFEIT ||
        match.scoreA != null ||
        match.scoreB != null ||
        match.winnerId)
  );
}

export function canGenerateOfficialKnockout(tournament, event, options = {}) {
  const errors = [];
  if (!event) {
    return { ok: false, errors: ["Thiếu nội dung thi đấu."], code: "NO_EVENT" };
  }
  const eventId = String(options.eventId || event?.id || "").trim();
  if (!eventId) {
    return {
      ok: false,
      errors: ["Chọn nội dung tường minh (eventId) trước khi tạo knockout."],
      code: "EVENT_REQUIRED",
    };
  }
  if (!isGroupStageComplete(event)) {
    return {
      ok: false,
      errors: ["Cần hoàn tất vòng bảng trước khi tạo knockout."],
      code: "GROUP_INCOMPLETE",
    };
  }
  if (hasBracketGenerated(event) && officialKnockoutHasStarted(event)) {
    return {
      ok: false,
      errors: ["Knockout đã bắt đầu — không tạo lại nhánh."],
      code: "KO_ALREADY_STARTED",
    };
  }
  if (hasBracketGenerated(event)) {
    return {
      ok: false,
      errors: ["Bracket knockout đã tồn tại."],
      code: "KO_ALREADY_GENERATED",
    };
  }

  // G2-F1: canonical admission before classic structure gate.
  const admission = resolveOfficialContentKnockoutAdmission(tournament, {
    eventId,
  });
  if (!admission.ok) {
    return {
      ok: false,
      errors: [admission.error || "Knockout admission chưa sẵn sàng."],
      code: admission.code || "KNOCKOUT_ADMISSION_NOT_READY",
      admission,
    };
  }

  const knockoutGate = resolveContentKnockoutRuntimeGate(tournament, { eventId });
  if (!knockoutGate.ok) {
    return {
      ok: false,
      errors: [knockoutGate.error || "Cấu trúc knockout Nội dung không hợp lệ."],
      code: knockoutGate.code || "KNOCKOUT_STRUCTURE_NOT_READY",
      knockoutGate,
      admission,
    };
  }

  const qualification = resolveOfficialQualificationReadiness(tournament, event, {
    ...options,
    eventId,
  });
  if (!qualification.ready) {
    return {
      ok: false,
      errors: [qualification.error || "Chưa sẵn sàng xét suất đi tiếp."],
      code: qualification.code || QUALIFICATION_NOT_READY || QUALIFICATION_TIE_UNRESOLVED,
      standings: qualification.standings,
      qualification,
      knockoutGate,
      admission,
    };
  }

  const qualifiersPerGroup = qualification.directQualifiersPerGroup;
  // CROSS_GROUP only (gate already enforced): reuse existing Official bracket engine.
  const generated = generateKnockoutBracket(event, { qualifiersPerGroup });
  if (!generated.ok) {
    return {
      ok: false,
      errors: generated.errors || ["Không tạo được bracket."],
      warnings: generated.warnings,
      code: "KO_GENERATE_FAILED",
      qualification,
      knockoutGate,
      admission,
    };
  }

  const previewFieldSize = Number(qualification.directQualifiedCount) || 0;
  if (previewFieldSize !== Number(qualification.totalRequired)) {
    return {
      ok: false,
      errors: [
        `Không tạo KO nhỏ hơn tổng suất: field=${previewFieldSize}, totalQualifiers=${qualification.totalRequired}.`,
      ],
      code: QUALIFICATION_NOT_READY,
      qualification,
      knockoutGate,
      admission,
    };
  }

  if (previewFieldSize !== Number(knockoutGate.qualifierCount)) {
    return {
      ok: false,
      errors: [
        `KNOCKOUT_SIZE_MISMATCH: field=${previewFieldSize}, knockout.qualifierCount=${knockoutGate.qualifierCount}.`,
      ],
      code: "KNOCKOUT_SIZE_MISMATCH",
      qualification,
      knockoutGate,
      admission,
    };
  }

  const integrityResult = assertOfficialKnockoutFirstRoundIntegrity(
    generated.event?.bracket?.rounds || [],
    qualification.standings || generated.groupStandings || [],
    {
      avoidSameGroupFirstRound: knockoutGate.avoidSameGroupFirstRound,
    }
  );
  if (!integrityResult.ok) {
    return {
      ok: false,
      errors: [integrityResult.error || "Vòng 1 knockout không đạt ràng buộc."],
      code: integrityResult.code || "KNOCKOUT_PAIRING_CONSTRAINT_UNSATISFIED",
      qualification,
      knockoutGate,
      admission,
      integrity: integrityResult,
    };
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings: generated.warnings || [],
    qualifiersPerGroup,
    standings: qualification.standings,
    qualification,
    knockoutGate,
    admission,
    pairingPolicy: CONTENT_KNOCKOUT_PAIRING_POLICY.CROSS_GROUP,
    avoidSameGroupFirstRound: knockoutGate.avoidSameGroupFirstRound,
    integrity: integrityResult,
    preview: generated,
  };
}

export function generateOfficialKnockout(tournament, event, options = {}) {
  const check = canGenerateOfficialKnockout(tournament, event, options);
  if (!check.ok) {
    return check;
  }
  return {
    ok: true,
    event: check.preview.event,
    warnings: check.warnings,
    knockoutMatchCount: check.preview.knockoutMatchCount,
    qualifiersPerGroup: check.qualifiersPerGroup,
    groupStandings: check.standings,
    qualification: check.qualification,
    knockoutGate: check.knockoutGate,
    admission: check.admission,
    pairingPolicy: check.pairingPolicy,
    avoidSameGroupFirstRound: check.avoidSameGroupFirstRound,
    integrity: check.integrity,
  };
}
