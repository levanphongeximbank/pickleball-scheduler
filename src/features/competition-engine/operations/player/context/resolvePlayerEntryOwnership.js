/**
 * Resolve canonical player → entry ownership for E2E-04.
 * Never trusts a bare client playerId / entryId without mapping + ownership.
 */

import { PLAYER_ERROR_CODE } from "../constants.js";
import { failPlayer } from "../errors.js";
import { isNonEmptyString } from "../../fingerprint.js";

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function asObject(value) {
  return value && typeof value === "object"
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}

/**
 * @param {{
 *   actor: { actorId?: string, playerId?: string, linkedPlayerId?: string, [k: string]: unknown },
 *   claimedPlayerId?: string|null,
 *   claimedEntryId?: string|null,
 *   claimedParticipantId?: string|null,
 *   record: object,
 *   runtimePorts: { participantLookupPort?: { resolveParticipantSnapshot?: Function } },
 * }} input
 */
export function resolvePlayerEntryOwnership(input) {
  const actor = asObject(input.actor);
  const record = asObject(input.record);
  const ports = input.runtimePorts || {};

  const actorCanonicalPlayerId =
    (isNonEmptyString(actor.playerId) && String(actor.playerId).trim()) ||
    (isNonEmptyString(actor.linkedPlayerId) &&
      String(actor.linkedPlayerId).trim()) ||
    (isNonEmptyString(actor.actorId) && String(actor.actorId).trim()) ||
    null;

  if (!actorCanonicalPlayerId) {
    failPlayer(
      PLAYER_ERROR_CODE.MISSING_IDENTITY,
      "Canonical player identity cannot be resolved from actor",
      {}
    );
  }

  const claimedPlayerId = isNonEmptyString(input.claimedPlayerId)
    ? String(input.claimedPlayerId).trim()
    : null;

  if (claimedPlayerId && claimedPlayerId !== actorCanonicalPlayerId) {
    failPlayer(
      PLAYER_ERROR_CODE.WRONG_PLAYER_ID,
      "Client playerId does not match authenticated actor mapping",
      {
        claimedPlayerId,
        actorCanonicalPlayerId,
      }
    );
  }

  let mappedParticipantId = actorCanonicalPlayerId;
  const lookup = ports.participantLookupPort;
  if (lookup && typeof lookup.resolveParticipantSnapshot === "function") {
    const resolved = lookup.resolveParticipantSnapshot(actorCanonicalPlayerId);
    if (!resolved || resolved.ok !== true || !resolved.participant?.id) {
      failPlayer(
        PLAYER_ERROR_CODE.MISSING_PLAYER_MAPPING,
        "Canonical player mapping is missing",
        {
          playerId: actorCanonicalPlayerId,
          code: resolved?.code || null,
        }
      );
    }
    mappedParticipantId = String(resolved.participant.id).trim();
  }

  const entries = Array.isArray(record.entries) ? record.entries : [];
  const claimedEntryId = isNonEmptyString(input.claimedEntryId)
    ? String(input.claimedEntryId).trim()
    : null;
  const claimedParticipantId = isNonEmptyString(input.claimedParticipantId)
    ? String(input.claimedParticipantId).trim()
    : null;

  const ownEntries = entries.filter((e) => {
    const participantId = String(e?.participantId || e?.id || "").trim();
    const entryId = String(e?.entryId || e?.id || participantId).trim();
    const playerId = String(e?.playerId || "").trim();
    return (
      participantId === mappedParticipantId ||
      participantId === actorCanonicalPlayerId ||
      playerId === actorCanonicalPlayerId ||
      entryId === mappedParticipantId
    );
  });

  if (claimedParticipantId) {
    const match = ownEntries.find(
      (e) => String(e?.participantId || "").trim() === claimedParticipantId
    );
    if (!match) {
      failPlayer(
        PLAYER_ERROR_CODE.ENTRY_NOT_OWNED,
        "Claimed participantId is not owned by the authenticated player",
        { claimedParticipantId, mappedParticipantId }
      );
    }
  }

  if (claimedEntryId) {
    const match = ownEntries.find((e) => {
      const entryId = String(e?.entryId || e?.id || e?.participantId || "").trim();
      return entryId === claimedEntryId;
    });
    if (!match) {
      failPlayer(
        PLAYER_ERROR_CODE.ENTRY_NOT_OWNED,
        "Claimed entryId is not owned by the authenticated player",
        { claimedEntryId, mappedParticipantId }
      );
    }
  }

  if (ownEntries.length === 0) {
    failPlayer(
      PLAYER_ERROR_CODE.ENTRY_NOT_OWNED,
      "No competition entry owned by authenticated player",
      { mappedParticipantId, actorCanonicalPlayerId }
    );
  }

  const primary = ownEntries[0];
  const entryId = String(
    primary.entryId || primary.id || primary.participantId || ""
  ).trim();
  const participantId = String(primary.participantId || entryId).trim();

  return Object.freeze({
    actorCanonicalPlayerId,
    mappedParticipantId,
    entryId,
    participantId,
    entry: Object.freeze({ ...primary }),
    ownedEntryIds: Object.freeze(
      ownEntries.map((e) =>
        String(e.entryId || e.id || e.participantId || "").trim()
      )
    ),
  });
}
