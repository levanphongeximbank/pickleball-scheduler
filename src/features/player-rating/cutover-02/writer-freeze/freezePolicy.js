/**
 * Writer-freeze policy: OFF | OBSERVE | ENFORCE.
 * Production deny forces OFF. V5 shadow writers never blocked.
 */

import { getWriterFreezeMode, resolveCutover02Config } from "../config/featureFlags.js";
import { CUTOVER_02_WRITER_ID, WRITER_FREEZE_MODE } from "../constants/writerIds.js";
import { hashPlayerIdForEvidence, sanitizeEvidenceValue } from "../evidence/sanitizeEvidence.js";
import { getWriterInventoryRow } from "./writerInventory.js";

/** @type {Array<Record<string, unknown>>} */
const attemptSink = [];

export function __resetWriterFreezeAttemptsForTests() {
  attemptSink.length = 0;
}

export function __getWriterFreezeAttemptsForTests() {
  return attemptSink.slice();
}

export const WRITER_FREEZE_BLOCK_CODE = "RATING_V5_WRITER_FREEZE_ENFORCED";

/**
 * @param {string} writerId
 * @param {ReturnType<typeof resolveCutover02Config>} config
 */
export function isWriterFreezeTarget(writerId, config) {
  const row = getWriterInventoryRow(writerId);
  if (!row) return false;
  if (!row.stagingFreezeTarget) return false;
  if (!row.writesPublishedSkill) return false;
  // Enforce only when mode is ENFORCE and env allows.
  return config.writerFreezeMode === WRITER_FREEZE_MODE.ENFORCE;
}

/**
 * Evaluate a writer attempt under freeze policy.
 *
 * @param {{
 *   writerId: string,
 *   playerId?: string|null,
 *   tenantId?: string|null,
 *   source?: string|null,
 *   env?: Record<string, unknown>,
 *   emit?: (evidence: Record<string, unknown>) => void,
 *   now?: string,
 *   details?: Record<string, unknown>,
 * }} input
 */
export function evaluateWriterFreezeAttempt(input) {
  const config = resolveCutover02Config(input.env);
  const writerId = String(input.writerId || "");
  const row = getWriterInventoryRow(writerId);
  const mode = config.writerFreezeMode || getWriterFreezeMode(input.env);

  const evidenceBase = sanitizeEvidenceValue({
    kind: "writer_freeze_attempt",
    at: input.now || new Date().toISOString(),
    writerId,
    mode,
    playerIdHash: hashPlayerIdForEvidence(input.playerId),
    tenantId: input.tenantId || null,
    source: input.source || null,
    stagingFreezeTarget: row?.stagingFreezeTarget === true,
    writesPublishedSkill: row?.writesPublishedSkill === true,
    writesV5Shadow: row?.writesV5Shadow === true,
    productionDenied: config.productionDenied,
    details: input.details || null,
  });

  const recordAttempt = (extra) => {
    const payload = sanitizeEvidenceValue({ ...evidenceBase, ...extra });
    attemptSink.push(payload);
    if (typeof input.emit === "function") {
      try {
        input.emit(payload);
      } catch {
        // never break caller
      }
    }
    return payload;
  };

  // Unknown writers: observe when not OFF; never ENFORCE-block unknown (avoid collateral).
  if (!row) {
    if (mode === WRITER_FREEZE_MODE.OFF) {
      return Object.freeze({
        allowed: true,
        blocked: false,
        mode,
        recorded: false,
        reason: "UNKNOWN_WRITER_PASS_THROUGH",
        evidence: null,
        bypassRisk: "UNKNOWN_WRITER",
      });
    }
    const evidence = recordAttempt({
      allowed: true,
      blocked: false,
      unexpectedWriter: true,
      reason: "UNEXPECTED_WRITER_OBSERVED",
    });
    return Object.freeze({
      allowed: true,
      blocked: false,
      mode,
      recorded: true,
      reason: "UNEXPECTED_WRITER_OBSERVED",
      evidence,
      bypassRisk: "UNKNOWN_WRITER",
    });
  }

  // V5 shadow + unrelated must always pass (even ENFORCE).
  if (row.writesV5Shadow || row.allowedDuringRehearsalEnforce) {
    if (mode === WRITER_FREEZE_MODE.OFF) {
      return Object.freeze({
        allowed: true,
        blocked: false,
        mode,
        recorded: false,
        reason: "NON_TARGET_OR_ALLOWED",
        evidence: null,
      });
    }
    const evidence = recordAttempt({
      allowed: true,
      blocked: false,
      reason: "NON_TARGET_ALLOWED_UNDER_FREEZE",
    });
    return Object.freeze({
      allowed: true,
      blocked: false,
      mode,
      recorded: true,
      reason: "NON_TARGET_ALLOWED_UNDER_FREEZE",
      evidence,
    });
  }

  if (mode === WRITER_FREEZE_MODE.OFF) {
    return Object.freeze({
      allowed: true,
      blocked: false,
      mode,
      recorded: false,
      reason: "FREEZE_OFF",
      evidence: null,
    });
  }

  if (mode === WRITER_FREEZE_MODE.OBSERVE) {
    const evidence = recordAttempt({
      allowed: true,
      blocked: false,
      reason: "OBSERVE_ONLY",
    });
    return Object.freeze({
      allowed: true,
      blocked: false,
      mode,
      recorded: true,
      reason: "OBSERVE_ONLY",
      evidence,
    });
  }

  // ENFORCE
  if (row.stagingFreezeTarget && row.writesPublishedSkill) {
    const evidence = recordAttempt({
      allowed: false,
      blocked: true,
      reason: WRITER_FREEZE_BLOCK_CODE,
      code: WRITER_FREEZE_BLOCK_CODE,
    });
    return Object.freeze({
      allowed: false,
      blocked: true,
      mode,
      recorded: true,
      reason: WRITER_FREEZE_BLOCK_CODE,
      code: WRITER_FREEZE_BLOCK_CODE,
      evidence,
      directCallBypassRisk: row.directCallBypassRisk,
    });
  }

  const evidence = recordAttempt({
    allowed: true,
    blocked: false,
    reason: "ENFORCE_NOT_TARGET",
  });
  return Object.freeze({
    allowed: true,
    blocked: false,
    mode,
    recorded: true,
    reason: "ENFORCE_NOT_TARGET",
    evidence,
  });
}

/**
 * Guard wrapper for legacy published-skill writers.
 * @param {string} writerId
 * @param {() => Promise<unknown>|unknown} proceed
 * @param {Omit<Parameters<typeof evaluateWriterFreezeAttempt>[0], "writerId">} [meta]
 */
export async function withWriterFreezeGuard(writerId, proceed, meta = {}) {
  const decision = evaluateWriterFreezeAttempt({ ...meta, writerId });
  if (decision.blocked) {
    return {
      ok: false,
      code: WRITER_FREEZE_BLOCK_CODE,
      error: "Legacy published-rating writer blocked by Staging freeze ENFORCE.",
      freeze: decision,
    };
  }
  const result = await proceed();
  return result;
}

/** Convenience ids for common call sites */
export const FREEZE_TARGET_SYNC_RPC = CUTOVER_02_WRITER_ID.PICK_VN_SYNC_RATING_RPC;
export const FREEZE_ALLOWED_V5_PERSIST = CUTOVER_02_WRITER_ID.V5_PERSIST_ASSESSMENT;
export const FREEZE_ALLOWED_CC02_ELO = CUTOVER_02_WRITER_ID.CC02_COMPETITION_ELO;
