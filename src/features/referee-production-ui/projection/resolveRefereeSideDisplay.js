/**
 * Distinguishes competition-unit / entry / team labels from individual athletes.
 * Projection / UX only — not identity authority. Never uses a display name as a writer id.
 */

import { formatParticipantDisplayName, isRawTechnicalId } from "./formatRefereeUiLabels.js";
import { REFEREE_MATCH_FORMAT } from "./projectCompetitionMatchFormat.js";

const GENERATED_TEAM_LABEL_RE = /^đội\s+\d+$/i;

function lookupRaw(token, names) {
  if (token == null) return null;
  const id = String(token).trim();
  if (!id) return null;
  const row = names?.[id];
  if (row && typeof row === "object") {
    const label = String(row.displayName || row.name || "").trim();
    return label || null;
  }
  if (typeof row === "string" && row.trim()) return row.trim();
  return null;
}

function humanLabel(raw) {
  const s = String(raw || "").trim();
  if (!s || s === "—" || isRawTechnicalId(s)) return null;
  return s;
}

export function isGeneratedTeamLabel(label) {
  return GENERATED_TEAM_LABEL_RE.test(String(label || "").trim());
}

/**
 * Resolve athlete display for one participant id. Never returns the parent entry/team label
 * when that label was copied onto members, or when it is a generated "Đội N" unit name.
 */
export function resolveAthleteDisplayName(participantId, names, side = {}) {
  const id = String(participantId || "").trim();
  if (!id) return null;
  const entryId = String(side?.entryId || side?.teamId || "").trim() || null;
  if (entryId && id === entryId) return null;
  const mapped = humanLabel(lookupRaw(id, names));
  if (!mapped) return null;
  const entryLabel =
    humanLabel(lookupRaw(entryId, names)) ||
    humanLabel(side?.displayName) ||
    humanLabel(side?.teamName) ||
    humanLabel(side?.entryName);
  // Generated unit labels ("Đội 9") are never athlete names.
  if (mapped === entryLabel && isGeneratedTeamLabel(entryLabel)) return null;
  return mapped;
}

/**
 * Presentation-only entry label. Durable identity is unchanged.
 * Singles: avoid implying doubles/"Đội" geometry from generated unit labels.
 * @param {string|null} entryLabel
 * @param {string|null} matchFormat
 * @param {object[]} members
 */
export function presentEntryLabel(entryLabel, matchFormat, members = []) {
  const label = humanLabel(entryLabel);
  if (!label) return null;
  const format = String(matchFormat || "").trim().toUpperCase();
  if (
    (format === REFEREE_MATCH_FORMAT.SINGLES ||
      format === REFEREE_MATCH_FORMAT.DREAMBREAKER) &&
    isGeneratedTeamLabel(label)
  ) {
    // Keep durable "Đội N" out of operator geometry language for singles.
    return members.length === 1 && members[0]?.displayName
      ? null
      : `Entry ${String(label).replace(/^đội\s+/i, "")}`;
  }
  return label;
}

/**
 * @param {object|null} side Adapter B participant side
 * @param {Record<string, string|object>} names participantNames directory
 * @param {{ matchFormat?: string|null }} [options]
 */
export function resolveRefereeSideDisplay(side, names = {}, options = {}) {
  const entryId = String(side?.entryId || side?.teamId || "").trim() || null;
  const entryLabel =
    humanLabel(lookupRaw(entryId, names)) ||
    humanLabel(side?.displayName) ||
    humanLabel(side?.teamName) ||
    humanLabel(side?.entryName) ||
    null;

  const rawIds = Array.isArray(side?.participantIds)
    ? side.participantIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const memberIds = rawIds.filter((id) => id && id !== entryId);

  let members = memberIds.map((participantId) => {
    const displayName = resolveAthleteDisplayName(participantId, names, {
      ...side,
      entryId,
    });
    return Object.freeze({
      participantId,
      displayName: displayName || null,
    });
  });

  const copiedTeamLabel =
    members.length >= 2 &&
    entryLabel &&
    members.every((row) => {
      const raw = humanLabel(lookupRaw(row.participantId, names));
      return raw === entryLabel;
    });
  if (copiedTeamLabel) {
    members = memberIds.map((participantId) =>
      Object.freeze({ participantId, displayName: null })
    );
  }

  const memberNames = members.map((row) => row.displayName).filter(Boolean);
  const memberLine = memberNames.length ? memberNames.join(" / ") : null;
  const honestMemberLine = members.length
    ? members
        .map((row) => row.displayName || "Chưa có tên")
        .join(" / ")
    : null;
  const presentationEntryLabel = presentEntryLabel(
    entryLabel,
    options.matchFormat,
    members
  );

  return Object.freeze({
    entryId,
    entryLabel,
    presentationEntryLabel,
    members: Object.freeze(members),
    memberNames: Object.freeze(memberNames),
    memberLine,
    honestMemberLine,
    label:
      presentationEntryLabel ||
      memberLine ||
      formatParticipantDisplayName(side?.displayName || side?.teamName),
  });
}
