/**
 * Read-only Official Group Draw review projection.
 * Presentation only — does not pair, redraw, persist, or invent group authority.
 *
 * Canonical:
 *   event.groups      = group-draw result
 *   event.drawEntries = generated pairs (individual doubles)
 *   event.entries     = original registrations
 *   event.matches     = generated competition matches
 */

import {
  isOfficialPairShapedEntry,
  listOfficialDrawEntries,
  listOfficialRegistrationEntries,
} from "./officialDrawOrchestrationEngine.js";

export const GROUP_MATCH_COUNT_SOURCE = "event.matches";

export const GROUP_REVIEW_ISSUE = Object.freeze({
  UNRESOLVED_MEMBER: "UNRESOLVED_MEMBER",
  DUPLICATE_PAIR: "DUPLICATE_PAIR",
  UNALLOCATED_DRAW_UNIT: "UNALLOCATED_DRAW_UNIT",
  IDENTITY_UNRESOLVED: "IDENTITY_UNRESOLVED",
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function primaryEvent(tournament, eventId = "") {
  const events = Array.isArray(tournament?.events) ? tournament.events : [];
  const wanted = eventId != null ? String(eventId).trim() : "";
  if (wanted) {
    return events.find((event) => String(event.id) === wanted) || null;
  }
  if (events.length === 1) return events[0] || null;
  return null;
}

export function isRawTechnicalId(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  if (UUID_RE.test(text)) return true;
  if (/^(pair-|entry-|e-|group-|draw-)/i.test(text) && !/\s/.test(text)) return true;
  return false;
}

function extractGroupLetter(group, index) {
  const candidates = [group?.label, group?.name].map((value) => String(value || "").trim());
  for (const candidate of candidates) {
    if (/^[A-Za-z]$/.test(candidate)) {
      return candidate.toUpperCase();
    }
    const named = candidate.match(/(?:Bảng|Bang)\s*([A-Za-z])/i);
    if (named) {
      return named[1].toUpperCase();
    }
  }
  return String.fromCharCode(65 + (Number(index) % 26));
}

export function presentOfficialGroupLabel(group, index = 0) {
  return `Bảng ${extractGroupLetter(group, index)}`;
}

export const UNRESOLVED_COMPETITION_SIDE_LABEL = "Không xác định cặp thi đấu";

function presentSide(entryId, unit, playersById) {
  const member = projectMember(entryId, unit, playersById, 1);
  if (!entryId) {
    return {
      competitionEntryId: "",
      label: UNRESOLVED_COMPETITION_SIDE_LABEL,
      memberNames: [],
      resolved: false,
    };
  }
  if (!member.resolved) {
    return {
      competitionEntryId: String(entryId),
      label: UNRESOLVED_COMPETITION_SIDE_LABEL,
      memberNames: [member.playerA, member.playerB].filter(Boolean),
      resolved: false,
      integrityError: true,
    };
  }
  return {
    competitionEntryId: String(entryId),
    label: member.playersLine,
    memberNames: member.playerB ? [member.playerA, member.playerB] : [member.playerA],
    resolved: true,
  };
}

function formatCourtLabel(match, courts = []) {
  if (!match?.courtId) return "";
  const court = (courts || []).find((item) => String(item.id) === String(match.courtId));
  if (court?.name && !isRawTechnicalId(court.name)) {
    return String(court.name).trim();
  }
  if (court?.number != null && court.number !== "") {
    return `Sân ${court.number}`;
  }
  return court ? `Sân ${court.id}` : "";
}

/**
 * Read-only human-readable match identity.
 * Resolves competition units from drawEntries → group.entries → entries → players.
 * Does not mutate tournament data and does not invent TBD when references exist.
 */
export function projectOfficialMatchPresentation(
  tournament,
  match,
  { eventId = "", players = [], courts = [] } = {}
) {
  const event = primaryEvent(tournament, eventId || match?.eventId || "");
  const groups = Array.isArray(event?.groups) ? event.groups : [];
  const groupIndex = groups.findIndex((group) => String(group?.id) === String(match?.groupId));
  const group = groupIndex >= 0 ? groups[groupIndex] : null;
  const unitsById = buildUnitMap(event);
  const playersById = playerMap(players);
  const sideA = presentSide(
    match?.entryAId,
    unitsById.get(String(match?.entryAId || "")) || null,
    playersById
  );
  const sideB = presentSide(
    match?.entryBId,
    unitsById.get(String(match?.entryBId || "")) || null,
    playersById
  );
  const groupMatches = (event?.matches || []).filter(
    (item) => !item.bracketMatchId && String(item.groupId) === String(match?.groupId || "")
  );
  const matchIndex = Math.max(
    0,
    groupMatches.findIndex((item) => String(item.id) === String(match?.id))
  );
  const groupLabel = group ? presentOfficialGroupLabel(group, groupIndex) : "";
  const heading = groupLabel ? `${groupLabel} · Trận ${matchIndex + 1}` : `Trận ${matchIndex + 1}`;
  const integrityError = !sideA.resolved || !sideB.resolved;

  return {
    matchId: String(match?.id || ""),
    groupId: String(match?.groupId || ""),
    groupLabel,
    heading,
    matchIndex: matchIndex + 1,
    sideA,
    sideB,
    vsLine: `${sideA.label} vs ${sideB.label}`,
    scheduledAt: match?.scheduledStart || match?.scheduledAt || null,
    scheduledEnd: match?.scheduledEnd || null,
    courtId: match?.courtId || null,
    courtLabel: formatCourtLabel(match, courts),
    status: match?.status || "",
    referee: match?.referee || null,
    resolved: !integrityError,
    integrityError,
    integrityMessage: integrityError ? UNRESOLVED_COMPETITION_SIDE_LABEL : "",
  };
}

export function projectOfficialGroupStageMatches(
  tournament,
  eventId = "",
  { players = [], courts = [] } = {}
) {
  const event = primaryEvent(tournament, eventId);
  const matches = (event?.matches || []).filter((match) => !match.bracketMatchId);
  const byMatchId = {};
  const rows = matches.map((match) => {
    const presentation = projectOfficialMatchPresentation(tournament, match, {
      eventId: event?.id || eventId,
      players,
      courts,
    });
    byMatchId[presentation.matchId] = presentation;
    return presentation;
  });
  return {
    rows,
    byMatchId,
    matchCount: rows.length,
    matchCountSource: GROUP_MATCH_COUNT_SOURCE,
  };
}

function playerMap(players = []) {
  return new Map((players || []).map((player) => [String(player.id), player]));
}

function splitStoredPairName(name) {
  const raw = String(name || "").trim();
  if (!raw) return [];
  return raw
    .split(/\s*\/\s*|\s+\+\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function resolvePlayerName(playerId, playersById, fallbackName) {
  const fromDir = playersById.get(String(playerId || ""))?.name;
  if (fromDir && !isRawTechnicalId(fromDir)) {
    return String(fromDir).trim();
  }
  if (fallbackName && !isRawTechnicalId(fallbackName)) {
    return String(fallbackName).trim();
  }
  return "";
}

function buildUnitMap(event) {
  const map = new Map();
  const add = (entry) => {
    if (entry?.id === undefined || entry?.id === null) return;
    const id = String(entry.id);
    if (!map.has(id)) {
      map.set(id, entry);
    }
  };
  listOfficialDrawEntries(event).forEach(add);
  (event?.groups || []).forEach((group) => (group?.entries || []).forEach(add));
  listOfficialRegistrationEntries(event).forEach(add);
  return map;
}

function expectedAllocatedUnits(event) {
  const drawPairs = listOfficialDrawEntries(event).filter(isOfficialPairShapedEntry);
  if (drawPairs.length > 0) {
    return { units: drawPairs, source: "drawEntries" };
  }
  return {
    units: listOfficialRegistrationEntries(event),
    source: "entries",
  };
}

function memberIdsForGroup(group) {
  const fromIds = Array.isArray(group?.entryIds)
    ? group.entryIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  if (fromIds.length) {
    return fromIds;
  }
  return (group?.entries || [])
    .map((entry) => String(entry?.id || "").trim())
    .filter(Boolean);
}

function projectMember(entryId, unit, playersById, ordinal) {
  const ids = Array.isArray(unit?.playerIds) ? unit.playerIds.map(String) : [];
  const storedNames = splitStoredPairName(unit?.name);
  const playerA = resolvePlayerName(ids[0], playersById, storedNames[0]);
  const playerB = resolvePlayerName(ids[1], playersById, storedNames[1]);
  const pairShaped = ids.length >= 2 || storedNames.length >= 2;
  const resolvedIdentity = pairShaped ? Boolean(playerA && playerB) : Boolean(playerA);
  const displayTitle = pairShaped ? `Cặp ${ordinal}` : playerA || `VĐV ${ordinal}`;
  const playersLine = pairShaped
    ? resolvedIdentity
      ? `${playerA} + ${playerB}`
      : ""
    : playerA;
  const rating =
    unit?.rating != null && unit.rating !== "" && Number.isFinite(Number(unit.rating))
      ? Number(unit.rating)
      : null;

  return {
    pairId: String(entryId),
    entryId: String(entryId),
    displayTitle,
    playerA: playerA || "",
    playerB: playerB || "",
    playersLine,
    ratingSummary: rating != null && rating > 0 ? String(rating) : null,
    resolved: Boolean(unit) && resolvedIdentity,
    playerIds: ids,
  };
}

function emptyReview(overrides = {}) {
  return {
    present: false,
    ok: true,
    groups: [],
    groupCount: 0,
    pairTotal: 0,
    uniquePairTotal: 0,
    expectedAllocatedTotal: 0,
    unallocatedIds: [],
    unresolvedIds: [],
    duplicateIds: [],
    issues: [],
    matchCount: 0,
    matchCountSource: GROUP_MATCH_COUNT_SOURCE,
    identitySource: "drawEntries+entries+players",
    ...overrides,
  };
}

/**
 * @returns {object} presentation-ready group review; never mutates tournament
 */
export function projectOfficialGroupDrawReview(tournament, eventId = "", players = []) {
  const event = primaryEvent(tournament, eventId);
  const groups = Array.isArray(event?.groups) ? event.groups : [];
  const matchCount = Array.isArray(event?.matches) ? event.matches.length : 0;
  const expected = expectedAllocatedUnits(event);
  const expectedIds = new Set(expected.units.map((unit) => String(unit.id)));

  if (!event || groups.length === 0) {
    return emptyReview({
      expectedAllocatedTotal: expectedIds.size,
      matchCount,
    });
  }

  const unitsById = buildUnitMap(event);
  const playersById = playerMap(players);
  const seen = new Map();
  const issues = [];
  const unresolvedIds = [];
  const duplicateIds = [];
  const projectedGroups = [];
  let pairTotal = 0;

  groups.forEach((group, groupIndex) => {
    const memberIds = memberIdsForGroup(group);
    const entries = memberIds.map((entryId, memberIndex) => {
      const unit = unitsById.get(String(entryId)) || null;
      const member = projectMember(entryId, unit, playersById, memberIndex + 1);
      pairTotal += 1;

      const previousGroup = seen.get(String(entryId));
      if (previousGroup) {
        duplicateIds.push(String(entryId));
        issues.push({
          code: GROUP_REVIEW_ISSUE.DUPLICATE_PAIR,
          message: `Cặp xuất hiện ở hai bảng (${previousGroup} và ${presentOfficialGroupLabel(group, groupIndex)}).`,
          entryId: String(entryId),
          groupId: String(group?.id || ""),
        });
      } else {
        seen.set(String(entryId), presentOfficialGroupLabel(group, groupIndex));
      }

      if (!unit) {
        unresolvedIds.push(String(entryId));
        issues.push({
          code: GROUP_REVIEW_ISSUE.UNRESOLVED_MEMBER,
          message: `Không tìm thấy cặp trong drawEntries/entries cho thành viên bảng ${presentOfficialGroupLabel(group, groupIndex)}.`,
          entryId: String(entryId),
          groupId: String(group?.id || ""),
        });
      } else if (!member.resolved) {
        unresolvedIds.push(String(entryId));
        issues.push({
          code: GROUP_REVIEW_ISSUE.IDENTITY_UNRESOLVED,
          message: `Không đọc được tên VĐV cho ${presentOfficialGroupLabel(group, groupIndex)} — ${member.displayTitle}.`,
          entryId: String(entryId),
          groupId: String(group?.id || ""),
        });
      }

      return member;
    });

    projectedGroups.push({
      groupId: String(group?.id || `group-${groupIndex}`),
      label: presentOfficialGroupLabel(group, groupIndex),
      entryCount: entries.length,
      entries,
    });
  });

  const unallocatedIds = [...expectedIds].filter((id) => !seen.has(id));
  unallocatedIds.forEach((entryId) => {
    issues.push({
      code: GROUP_REVIEW_ISSUE.UNALLOCATED_DRAW_UNIT,
      message: "Một cặp đã ghép không được chia vào bảng.",
      entryId,
    });
  });

  return {
    present: true,
    ok: issues.length === 0,
    groups: projectedGroups,
    groupCount: projectedGroups.length,
    pairTotal,
    uniquePairTotal: seen.size,
    expectedAllocatedTotal: expectedIds.size,
    unallocatedIds,
    unresolvedIds,
    duplicateIds,
    issues,
    matchCount,
    matchCountSource: GROUP_MATCH_COUNT_SOURCE,
    identitySource:
      expected.source === "drawEntries"
        ? "event.drawEntries + players"
        : "event.entries + players",
  };
}
