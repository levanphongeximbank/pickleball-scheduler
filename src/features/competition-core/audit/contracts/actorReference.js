import { AUDIT_ERROR_CODE } from "../errors/auditErrorCodes.js";
import { AuditError } from "../errors/AuditError.js";
import { ACTOR_KIND, isActorKind } from "../enums/actorKinds.js";
import { isNonEmptyString, isPlainObject, deepFreezeClone } from "../utils/helpers.js";

/**
 * @typedef {Object} ActorReference
 * @property {string} actorKind
 * @property {string|null} [actorId]
 * @property {string|null} [actorRole]
 */

/**
 * Map loose producer actorType strings onto CORE-20 ACTOR_KIND.
 * Does not import CORE-17 ownership.
 *
 * @param {unknown} actorType
 * @returns {string}
 */
export function mapLooseActorTypeToKind(actorType) {
  if (actorType == null || actorType === "") {
    return ACTOR_KIND.UNKNOWN;
  }
  const raw = String(actorType).trim().toUpperCase();
  if (isActorKind(raw)) return raw;
  switch (raw) {
    case "REFEREE":
    case "ORGANIZER":
    case "DIRECTOR":
    case "ADMIN":
    case "USER":
      return ACTOR_KIND.USER;
    case "LEGACY_ADAPTER":
    case "ADAPTER":
      return ACTOR_KIND.SERVICE;
    case "SYSTEM":
      return ACTOR_KIND.SYSTEM;
    case "SCHEDULER":
      return ACTOR_KIND.SCHEDULER;
    case "AUTOMATED_PROCESS":
    case "AUTOMATION":
      return ACTOR_KIND.AUTOMATED_PROCESS;
    case "MIGRATION":
      return ACTOR_KIND.MIGRATION;
    case "IMPORT":
      return ACTOR_KIND.IMPORT;
    default:
      return ACTOR_KIND.UNKNOWN;
  }
}

/**
 * @param {unknown} partial
 * @returns {Readonly<ActorReference>}
 */
export function createActorReference(partial = {}) {
  if (partial == null) {
    return Object.freeze({
      actorKind: ACTOR_KIND.UNKNOWN,
      actorId: null,
      actorRole: null,
    });
  }
  if (!isPlainObject(partial)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_ACTOR,
      "ActorReference must be a plain object",
      {}
    );
  }

  let actorKind = isNonEmptyString(partial.actorKind)
    ? String(partial.actorKind).trim().toUpperCase()
    : "";
  if (!actorKind && (partial.actorType != null || partial.kind != null)) {
    actorKind = mapLooseActorTypeToKind(partial.actorType ?? partial.kind);
  }
  if (!actorKind) {
    actorKind = ACTOR_KIND.UNKNOWN;
  }
  if (!isActorKind(actorKind)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_ACTOR,
      "Invalid actorKind",
      { actorKind }
    );
  }

  const actorId =
    partial.actorId == null || partial.actorId === ""
      ? null
      : String(partial.actorId).trim();
  const actorRole =
    partial.actorRole == null || partial.actorRole === ""
      ? null
      : String(partial.actorRole).trim();

  return Object.freeze(
    /** @type {ActorReference} */ (
      deepFreezeClone({
        actorKind,
        actorId,
        actorRole,
      })
    )
  );
}
