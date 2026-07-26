/**
 * Timestamp tolerance + replay classification for webhook ingress.
 * Deterministic. No crypto. No network.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  WEBHOOK_REPLAY_CLASSIFICATION,
  WEBHOOK_TIMESTAMP_POLICY_VERSION,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireIsoInstant,
  requireNonEmptyString,
} from "./shared.js";

export const WEBHOOK_TIMESTAMP_TOLERANCE_ERROR = Object.freeze({
  INVALID: "WEBHOOK_TIMESTAMP_TOLERANCE_INVALID",
  VERSION_INVALID: "WEBHOOK_TIMESTAMP_TOLERANCE_VERSION_INVALID",
  SKEW_INVALID: "WEBHOOK_TIMESTAMP_TOLERANCE_SKEW_INVALID",
  TIMESTAMP_INVALID: "WEBHOOK_TIMESTAMP_TOLERANCE_TIMESTAMP_INVALID",
});

export const DEFAULT_WEBHOOK_MAX_SKEW_SECONDS = 300;

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createWebhookTimestampPolicy(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        WEBHOOK_TIMESTAMP_TOLERANCE_ERROR.INVALID,
        "WebhookTimestampPolicy input must be a plain object"
      )
    );
  }

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? WEBHOOK_TIMESTAMP_POLICY_VERSION,
    "contractVersion",
    WEBHOOK_TIMESTAMP_TOLERANCE_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const maxSkewSeconds =
    input.maxSkewSeconds != null
      ? Number(input.maxSkewSeconds)
      : DEFAULT_WEBHOOK_MAX_SKEW_SECONDS;

  if (!Number.isFinite(maxSkewSeconds) || maxSkewSeconds < 0) {
    return fail(
      contractError(
        WEBHOOK_TIMESTAMP_TOLERANCE_ERROR.SKEW_INVALID,
        "maxSkewSeconds must be a non-negative finite number",
        "maxSkewSeconds"
      )
    );
  }

  return ok(
    deepFreeze({
      contractVersion: contractVersion.value,
      maxSkewSeconds,
    })
  );
}

/**
 * Classify timestamp freshness / replay risk without retaining secrets.
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function classifyWebhookTimestampTolerance(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        WEBHOOK_TIMESTAMP_TOLERANCE_ERROR.INVALID,
        "classifyWebhookTimestampTolerance input must be a plain object"
      )
    );
  }

  const policyResult = createWebhookTimestampPolicy({
    maxSkewSeconds: input.maxSkewSeconds,
    contractVersion: input.contractVersion,
  });
  if (!policyResult.ok) return policyResult;
  const policy = policyResult.value;

  if (input.timestampMalformed === true) {
    return ok(
      deepFreeze({
        classification: WEBHOOK_REPLAY_CLASSIFICATION.TIMESTAMP_MALFORMED,
        accepted: false,
        reason: "timestamp_malformed",
        maxSkewSeconds: policy.maxSkewSeconds,
      })
    );
  }

  if (
    input.providerTimestamp == null &&
    input.timestamp == null &&
    input.timestampPresent === false
  ) {
    return ok(
      deepFreeze({
        classification: WEBHOOK_REPLAY_CLASSIFICATION.TIMESTAMP_MISSING,
        accepted: false,
        reason: "timestamp_missing",
        maxSkewSeconds: policy.maxSkewSeconds,
      })
    );
  }

  const providerTimestampRaw =
    input.providerTimestamp ?? input.timestamp ?? null;
  if (providerTimestampRaw == null) {
    return ok(
      deepFreeze({
        classification: WEBHOOK_REPLAY_CLASSIFICATION.TIMESTAMP_MISSING,
        accepted: false,
        reason: "timestamp_missing",
        maxSkewSeconds: policy.maxSkewSeconds,
      })
    );
  }

  const providerTimestamp = requireIsoInstant(
    providerTimestampRaw,
    "providerTimestamp",
    WEBHOOK_TIMESTAMP_TOLERANCE_ERROR.TIMESTAMP_INVALID
  );
  if (!providerTimestamp.ok) {
    return ok(
      deepFreeze({
        classification: WEBHOOK_REPLAY_CLASSIFICATION.TIMESTAMP_MALFORMED,
        accepted: false,
        reason: "timestamp_malformed",
        maxSkewSeconds: policy.maxSkewSeconds,
      })
    );
  }

  const nowRaw = input.now ?? input.receivedAt;
  if (nowRaw == null) {
    return ok(
      deepFreeze({
        classification: WEBHOOK_REPLAY_CLASSIFICATION.WITHIN_TOLERANCE,
        accepted: true,
        reason: "timestamp_present_no_now_reference",
        providerTimestamp: providerTimestamp.value,
        maxSkewSeconds: policy.maxSkewSeconds,
      })
    );
  }

  const now = requireIsoInstant(
    nowRaw,
    "now",
    WEBHOOK_TIMESTAMP_TOLERANCE_ERROR.TIMESTAMP_INVALID
  );
  if (!now.ok) {
    return ok(
      deepFreeze({
        classification: WEBHOOK_REPLAY_CLASSIFICATION.TIMESTAMP_MALFORMED,
        accepted: false,
        reason: "now_malformed",
        providerTimestamp: providerTimestamp.value,
        maxSkewSeconds: policy.maxSkewSeconds,
      })
    );
  }

  const nowMs = Date.parse(now.value);
  const tsMs = Date.parse(providerTimestamp.value);
  if (Number.isNaN(nowMs) || Number.isNaN(tsMs)) {
    return ok(
      deepFreeze({
        classification: WEBHOOK_REPLAY_CLASSIFICATION.TIMESTAMP_MALFORMED,
        accepted: false,
        reason: "timestamp_parse_failed",
        providerTimestamp: providerTimestamp.value,
        maxSkewSeconds: policy.maxSkewSeconds,
      })
    );
  }

  const skewSeconds = Math.abs(nowMs - tsMs) / 1000;
  if (skewSeconds > policy.maxSkewSeconds) {
    return ok(
      deepFreeze({
        classification: WEBHOOK_REPLAY_CLASSIFICATION.EXPIRED,
        accepted: false,
        reason: "timestamp_outside_tolerance",
        providerTimestamp: providerTimestamp.value,
        now: now.value,
        skewSeconds,
        maxSkewSeconds: policy.maxSkewSeconds,
      })
    );
  }

  if (
    input.eventIdSeen === true ||
    input.replaySuspected === true
  ) {
    return ok(
      deepFreeze({
        classification: WEBHOOK_REPLAY_CLASSIFICATION.REPLAY_SUSPECTED,
        accepted: false,
        reason: "event_id_seen",
        providerTimestamp: providerTimestamp.value,
        now: now.value,
        skewSeconds,
        maxSkewSeconds: policy.maxSkewSeconds,
      })
    );
  }

  return ok(
    deepFreeze({
      classification:
        skewSeconds === 0
          ? WEBHOOK_REPLAY_CLASSIFICATION.FRESH
          : WEBHOOK_REPLAY_CLASSIFICATION.WITHIN_TOLERANCE,
      accepted: true,
      reason: "within_tolerance",
      providerTimestamp: providerTimestamp.value,
      now: now.value,
      skewSeconds,
      maxSkewSeconds: policy.maxSkewSeconds,
    })
  );
}
