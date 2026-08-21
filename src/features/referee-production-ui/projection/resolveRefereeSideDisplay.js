/**
 * Distinguishes competition-unit / entry / team labels from individual athletes.
 * Projection / UX only — not identity authority. Never uses a display name as a writer id.
 */

import { formatParticipantDisplayName, isRawTechnicalId } from "./formatRefereeUiLabels.js";

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
 * @param {object|null} side Adapter B participant side
 * @param {Record<string, string|object>} names participantNames directory
 */
export function resolveRefereeSideDisplay(side, names = {}) {
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

  return Object.freeze({
    entryId,
    entryLabel,
    members: Object.freeze(members),
    memberNames: Object.freeze(memberNames),
    memberLine,
    honestMemberLine,
    label:
      entryLabel ||
      memberLine ||
      formatParticipantDisplayName(side?.displayName || side?.teamName),
  });
}
