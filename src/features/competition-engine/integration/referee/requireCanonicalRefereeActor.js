/**
 * Canonical identity for durable referee writes: auth.uid / actorId only.
 */

import { REFEREE_ADAPTER_ERROR_CODE } from "./constants.js";
import { failRefereeAdapter } from "./errors.js";
import { isNonEmptyString } from "./helpers.js";

export function requireCanonicalRefereeActor(actor) {
  const actorId = String(actor?.actorId || actor?.authUid || "").trim();
  if (!actorId) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY,
      "Durable writes require canonical actorId (auth.uid)",
      {}
    );
  }
  if (
    isNonEmptyString(actor?.authUid) &&
    String(actor.authUid).trim() !== actorId
  ) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.FUZZY_IDENTITY_FORBIDDEN,
      "authUid must equal actorId",
      {}
    );
  }
  if (
    isNonEmptyString(actor?.refereeId) &&
    String(actor.refereeId).trim() !== actorId
  ) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.FUZZY_IDENTITY_FORBIDDEN,
      "refereeId must equal actorId; name/email/phone is not write authority",
      {}
    );
  }
  return actorId;
}
