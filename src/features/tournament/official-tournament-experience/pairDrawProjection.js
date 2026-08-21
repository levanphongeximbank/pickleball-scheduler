/**
 * Wave O4 — Official Pair Draw projection (Screen 07).
 * Pair Draw ≠ Pair Formation ≠ Group Draw.
 *
 * Existing Official authority:
 * - Competition units come from Screen 06 (drawEntries) or Open Pair entries.
 * - Presentation/reveal visualizes those units (animation is not persistence).
 * - lockDraw / publishDraw / recordDrawCreated operate on GROUP draw
 *   (tournament.settings.draw + groups) — not exposed as Pair Draw writers.
 */

import {
  listOfficialDrawEntries,
  projectOfficialDrawSubsteps,
  isOfficialPairShapedEntry,
  listOfficialRegistrationEntries,
} from "../../individual-tournament/engines/officialDrawOrchestrationEngine.js";
import { filterDrawEligibleEntries } from "../../individual-tournament/engines/withdrawalEngine.js";
import {
  PAIR_FORMATION_MODE,
  resolveOfficialPairFormationMode,
} from "./pairFormationModeResolver.js";
import { OFFICIAL_EXPERIENCE_AUTHORITY } from "./authorityLock.js";
import { listTournamentEvents, resolveSelectedEvent } from "../experience-a1/deriveOverview.js";
import { ANIMATION_MODES, buildPairingSteps } from "../../../components/tournament/animation/animationUtils.js";
import { canRegenerateDraw, getDrawPublishStatus } from "../../../tournament/engines/publishDrawEngine.js";

function trim(value) {
  return value != null ? String(value).trim() : "";
}

/**
 * Read competition units for Screen 07 without mutating.
 * @returns {{
 *   ok: boolean,
 *   units: object[],
 *   source: 'drawEntries'|'entries'|null,
 *   substeps: object|null,
 *   modeResolution: object,
 *   code?: string,
 *   error?: string,
 * }}
 */
export function listOfficialPairDrawUnits(tournament, { selectedEventId } = {}) {
  const events = listTournamentEvents(tournament);
  const eventId = trim(selectedEventId);
  if (events.length > 1 && !eventId) {
    return {
      ok: false,
      units: [],
      source: null,
      substeps: null,
      modeResolution: resolveOfficialPairFormationMode(tournament),
      code: "EVENT_REQUIRED",
      error: "Chọn nội dung trước khi xem bốc thăm ghép cặp.",
    };
  }
  const event = resolveSelectedEvent(events, eventId);
  if (!event) {
    return {
      ok: false,
      units: [],
      source: null,
      substeps: null,
      modeResolution: resolveOfficialPairFormationMode(tournament),
      code: "EVENT_NOT_FOUND",
      error: "Không tìm thấy nội dung thi đấu.",
    };
  }

  const modeResolution = resolveOfficialPairFormationMode(tournament);
  if (!modeResolution.ok || modeResolution.mode === PAIR_FORMATION_MODE.NOT_SUPPORTED) {
    return {
      ok: false,
      units: [],
      source: null,
      substeps: projectOfficialDrawSubsteps(tournament, event.id),
      modeResolution,
      code: modeResolution.code || "PAIR_DRAW_NOT_SUPPORTED",
      error: modeResolution.error || "Chế độ bốc thăm ghép cặp không được hỗ trợ.",
    };
  }

  const sub = projectOfficialDrawSubsteps(tournament, event.id);

  if (modeResolution.mode === PAIR_FORMATION_MODE.REGISTERED_PAIRS) {
    const eligible = filterDrawEligibleEntries(
      listOfficialRegistrationEntries(event),
      tournament
    );
    const units = eligible.filter(isOfficialPairShapedEntry);
    return {
      ok: units.length > 0,
      units,
      source: "entries",
      substeps: sub,
      modeResolution,
      code: units.length > 0 ? null : "UNITS_MISSING",
      error:
        units.length > 0
          ? null
          : "Chưa có cặp đăng ký hợp lệ để bốc thăm / trình chiếu.",
    };
  }

  // OPEN INDIVIDUAL / AI BALANCE — require persisted drawEntries from Screen 06
  const units = listOfficialDrawEntries(event).filter(isOfficialPairShapedEntry);
  if (!sub.pairingComplete || units.length < 1) {
    return {
      ok: false,
      units: [],
      source: "drawEntries",
      substeps: sub,
      modeResolution,
      code: "UNITS_MISSING",
      error:
        "Chưa có cặp đã hình thành (drawEntries). Vào Hình thành cặp / đội trước — không tự ghép trên màn này.",
    };
  }

  return {
    ok: true,
    units,
    source: "drawEntries",
    substeps: sub,
    modeResolution,
  };
}

/**
 * Presentation payload only — never a persistence patch.
 */
export function buildOfficialPresentPairDraw(tournament, options = {}) {
  const listed = listOfficialPairDrawUnits(tournament, options);
  if (!listed.ok) {
    return {
      ok: false,
      error: listed.error,
      code: listed.code,
      mutates: false,
    };
  }

  const steps = buildPairingSteps(listed.units);
  return {
    ok: true,
    mutates: false,
    mode: listed.modeResolution.mode,
    source: listed.source,
    unitCount: listed.units.length,
    units: listed.units.map((unit) => ({
      id: unit.id,
      playerIds: (unit.playerIds || []).map(String),
      name: unit.name || "",
    })),
    presentation: {
      animationMode: ANIMATION_MODES.PAIRING_REVEAL,
      steps,
      title:
        listed.modeResolution.mode === PAIR_FORMATION_MODE.AI_BALANCE_PAIRING
          ? "Trình chiếu cặp AI Balance"
          : listed.modeResolution.mode === PAIR_FORMATION_MODE.REGISTERED_PAIRS
            ? "Trình chiếu cặp đã đăng ký"
            : "Trình chiếu cặp Open",
      subtitle: "Hiệu ứng trình chiếu — không đổi membership / không ghi hồ sơ",
    },
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_PAIRING,
  };
}

/**
 * Unsafe redraw of Pair Draw stage: there is no pair-draw rewrite authority.
 * Group-draw regenerate (canRegenerateDraw) is reported for downstream awareness only.
 */
export function resolveOfficialPairDrawMutationGuards(tournament, { selectedEventId } = {}) {
  const listed = listOfficialPairDrawUnits(tournament, { selectedEventId });
  const sub = listed.substeps;
  const groupDrawPublish = getDrawPublishStatus(tournament);
  const regen = canRegenerateDraw(tournament);

  const blockers = [];
  if (sub?.groupsCreated) {
    blockers.push({
      code: "GROUPS_EXIST",
      message: "Đã có bảng đấu — không được viết lại cặp / thứ tự cặp trên màn này.",
    });
  }
  if (groupDrawPublish.status === "published" || groupDrawPublish.status === "locked") {
    blockers.push({
      code: "GROUP_DRAW_LOCKED_OR_PUBLISHED",
      message: "Bốc thăm chia bảng đã khóa/công bố — không redraw cặp.",
    });
  }
  if (!regen.ok) {
    blockers.push({
      code: "GROUP_DRAW_REGENERATE_BLOCKED",
      message: regen.error || "Không được regenerate bốc thăm (authority chia bảng).",
    });
  }

  return {
    pairDrawWriterExists: false,
    pairDrawLockAuthorityExists: false,
    pairDrawPublishAuthorityExists: false,
    presentOnly: true,
    canPresent: listed.ok === true,
    canMutatePairMembership: false,
    canReorderPersistently: false,
    canCreateDraw: false,
    canLock: false,
    canPublish: false,
    canReopen: false,
    canRegenerate: false,
    blockers,
    groupDrawPublishStatus: groupDrawPublish.status,
    groupsCreated: Boolean(sub?.groupsCreated),
    pairingComplete: Boolean(sub?.pairingComplete),
  };
}

export function projectOfficialPairDraw(tournament, { selectedEventId } = {}) {
  const listed = listOfficialPairDrawUnits(tournament, { selectedEventId });
  const guards = resolveOfficialPairDrawMutationGuards(tournament, { selectedEventId });
  const events = listTournamentEvents(tournament);
  const event = resolveSelectedEvent(events, trim(selectedEventId));

  return {
    modeResolution: listed.modeResolution,
    selectedEventId: trim(selectedEventId),
    selectedEvent: event
      ? { id: String(event.id), name: String(event.name || ""), eventType: event.eventType }
      : null,
    selectedEventExplicit: Boolean(trim(selectedEventId)) || events.length === 1,
    needsEventChoice: events.length > 1 && !trim(selectedEventId),
    unitsReady: listed.ok === true,
    unitCount: listed.units.length,
    source: listed.source,
    units: listed.units,
    substeps: listed.substeps,
    blocker: listed.ok ? null : { code: listed.code, error: listed.error },
    guards,
    groupDrawPublish: getDrawPublishStatus(tournament),
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_PAIRING,
    note:
      "Screen 07 đọc đơn vị cạnh tranh đã hình thành; trình chiếu không phải writer. lock/publish draw thuộc Group Draw.",
  };
}
