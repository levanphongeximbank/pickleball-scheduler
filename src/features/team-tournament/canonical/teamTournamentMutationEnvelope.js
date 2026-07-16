import {
  CanonicalValidationError,
  SETUP_COMMAND_REGISTRY,
  canonicalizeValue,
  normalizeCanonicalDate,
  normalizeCanonicalString,
  stableCanonicalStringify,
} from "./teamTournamentCanonicalRules.js";
import { hashUtf8Sha256Sync, isValidSha256Hex } from "./teamTournamentCanonicalDigest.js";

export const DEFAULT_ENGINE_VERSION = "team-tournament-engines@1.0.0";

/**
 * @param {Record<string, unknown>} envelope
 * @returns {string}
 */
export function calculateSetupMutationPayloadHash(envelope) {
  const withoutPayloadHash = { ...envelope };
  delete withoutPayloadHash.payloadHash;
  return hashUtf8Sha256Sync(stableCanonicalStringify(withoutPayloadHash));
}

/**
 * @param {object} params
 * @returns {object}
 */
export function buildSetupMutationEnvelope(params = {}) {
  const commandName = normalizeCanonicalString(params.commandName);
  if (!SETUP_COMMAND_REGISTRY.has(commandName)) {
    throw new CanonicalValidationError("INVALID_COMMAND", `commandName không hợp lệ: ${commandName}`);
  }

  const envelope = {
    commandName,
    tournamentId: normalizeCanonicalString(params.tournamentId),
    expectedTournamentVersion: Number(params.expectedTournamentVersion),
    idempotencyKey: normalizeCanonicalString(params.idempotencyKey),
    engineVersion: normalizeCanonicalString(params.engineVersion || DEFAULT_ENGINE_VERSION),
    rulesVersion: normalizeCanonicalString(params.rulesVersion || ""),
    engineInputHash: normalizeCanonicalString(params.engineInputHash).toLowerCase(),
    engineOutputHash: normalizeCanonicalString(params.engineOutputHash).toLowerCase(),
    generatedAt: normalizeCanonicalDate(params.generatedAt || new Date().toISOString()),
    generationMetadata: canonicalizeValue(params.generationMetadata || {}),
    confirmDestructive: params.confirmDestructive === true,
    payload: canonicalizeValue(params.payload ?? {}),
    payloadHash: "",
  };

  envelope.payloadHash = calculateSetupMutationPayloadHash(envelope);
  return envelope;
}

/**
 * @param {unknown} envelope
 * @returns {{ ok: true, envelope: object } | { ok: false, code: string, error: string }}
 */
export function validateSetupMutationEnvelope(envelope) {
  try {
    const value = canonicalizeValue(envelope);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, code: "VALIDATION_ERROR", error: "Envelope không hợp lệ." };
    }

    if (!SETUP_COMMAND_REGISTRY.has(value.commandName)) {
      return { ok: false, code: "INVALID_COMMAND", error: "commandName không nằm trong registry." };
    }
    if (!value.tournamentId) {
      return { ok: false, code: "VALIDATION_ERROR", error: "Thiếu tournamentId." };
    }
    if (!Number.isInteger(value.expectedTournamentVersion) || value.expectedTournamentVersion < 1) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        error: "expectedTournamentVersion phải là số nguyên >= 1.",
      };
    }
    if (!value.idempotencyKey || value.idempotencyKey.length > 128) {
      return { ok: false, code: "VALIDATION_ERROR", error: "idempotencyKey không hợp lệ." };
    }
    if (!value.engineVersion) {
      return { ok: false, code: "VALIDATION_ERROR", error: "Thiếu engineVersion." };
    }

    const pairingCommands = new Set([
      "groups.replace",
      "groups.clear",
      "matchups.replace",
      "schedule.batch",
      "schedule.publish",
    ]);
    if (pairingCommands.has(value.commandName) && !value.rulesVersion) {
      return { ok: false, code: "VALIDATION_ERROR", error: "Thiếu rulesVersion cho lệnh pairing." };
    }

    for (const hashField of ["engineInputHash", "engineOutputHash", "payloadHash"]) {
      if (!isValidSha256Hex(value[hashField])) {
        return { ok: false, code: "VALIDATION_ERROR", error: `${hashField} không hợp lệ.` };
      }
    }

    const recalculated = calculateSetupMutationPayloadHash(value);
    if (recalculated !== value.payloadHash) {
      return { ok: false, code: "PAYLOAD_HASH_MISMATCH", error: "payloadHash không khớp." };
    }

    if (typeof value.confirmDestructive !== "boolean") {
      return { ok: false, code: "VALIDATION_ERROR", error: "confirmDestructive phải là boolean." };
    }
    if (value.payload === undefined || value.payload === null) {
      return { ok: false, code: "VALIDATION_ERROR", error: "Thiếu payload." };
    }

    return { ok: true, envelope: value };
  } catch (error) {
    if (error instanceof CanonicalValidationError) {
      return { ok: false, code: error.code, error: error.message };
    }
    return { ok: false, code: "VALIDATION_ERROR", error: error?.message || "Envelope không hợp lệ." };
  }
}
