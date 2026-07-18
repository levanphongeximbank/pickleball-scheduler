/**
 * Phase 3B — participant shadow normalizer (fixture / non-Production).
 * Produces a stable fingerprint for identity-critical fields only.
 */

import { identityFromCompetitionParticipant } from "../../../contracts/identity.js";

/**
 * @param {unknown} payload
 * @returns {{
 *   fingerprint: string|null,
 *   normalized: Record<string, unknown>|null,
 * }}
 */
export function normalizeParticipantShadowPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { fingerprint: null, normalized: null };
  }

  const p = /** @type {Record<string, unknown>} */ (payload);
  const person =
    p.person && typeof p.person === "object"
      ? /** @type {Record<string, unknown>} */ (p.person)
      : null;

  const identity =
    identityFromCompetitionParticipant(
      /** @type {import('../../../contracts/competitionParticipant.js').CompetitionParticipant} */ (
        p
      )
    ) || null;

  const normalized = {
    competitionId: p.competitionId ?? null,
    participantId: p.id ?? null,
    kind: person?.kind ?? null,
    personId: person?.id ?? null,
    identityKey: identity?.key ?? null,
    status: p.status ?? null,
    displayName: p.displayName ?? person?.displayNameSnapshot ?? null,
  };

  const fingerprint = [
    normalized.competitionId,
    normalized.kind,
    normalized.personId,
    normalized.identityKey,
    normalized.status,
  ]
    .map((v) => String(v ?? ""))
    .join("|");

  return { fingerprint, normalized };
}
