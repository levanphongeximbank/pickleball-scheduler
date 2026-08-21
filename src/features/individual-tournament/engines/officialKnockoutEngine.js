/**
 * Official knockout generation / regeneration guards (UI preview only).
 * Canonical persist is official_open_generate_knockout — do not client-write the bracket.
 */

import {
  generateKnockoutBracket,
  hasBracketGenerated,
  isGroupStageComplete,
} from "../../../tournament/engines/bracketEngine.js";
import { MATCH_STATUS } from "../../../models/tournament/constants.js";
import {
  officialQualificationReady,
  resolveOfficialQualifiersPerGroup,
  QUALIFICATION_TIE_UNRESOLVED,
} from "./officialStandingsEngine.js";

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
  const qualifiersPerGroup = resolveOfficialQualifiersPerGroup(tournament, {
    ...options,
    eventId: options.eventId || event?.id,
  });
  const qualification = officialQualificationReady(event, { qualifiersPerGroup });
  if (!qualification.ready) {
    return {
      ok: false,
      errors: [qualification.error],
      code: qualification.code || QUALIFICATION_TIE_UNRESOLVED,
      standings: qualification.standings,
    };
  }
  const generated = generateKnockoutBracket(event, { qualifiersPerGroup });
  if (!generated.ok) {
    return {
      ok: false,
      errors: generated.errors || ["Không tạo được bracket."],
      warnings: generated.warnings,
      code: "KO_GENERATE_FAILED",
    };
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings: generated.warnings || [],
    qualifiersPerGroup,
    standings: qualification.standings,
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
  };
}
