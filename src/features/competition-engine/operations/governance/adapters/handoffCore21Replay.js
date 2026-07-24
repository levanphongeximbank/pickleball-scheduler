/**
 * CORE-21 replay readiness governance — no parallel replay engine.
 */

import {
  composeCanonicalSeed,
  createSeedIdentity,
  fingerprintValue,
  sortStableIds,
} from "../../../../competition-core/deterministic-seed-replay/index.js";
import {
  ISSUE_SEVERITY,
  ISSUE_SOURCE_OWNER,
  RELIABILITY_ISSUE_CODE,
} from "../constants.js";
import {
  computeGovernanceFingerprint,
  deepFreeze,
  isNonEmptyString,
} from "../fingerprint.js";

/**
 * @param {object} record
 * @param {object} [query]
 */
export function evaluateReplayReadiness(record, query = {}) {
  const replay = record?.replay && typeof record.replay === "object" ? record.replay : {};
  const events = Array.isArray(query.events)
    ? query.events
    : Array.isArray(replay.events)
      ? replay.events
      : [];

  const issues = [];
  const seed = isNonEmptyString(query.seed)
    ? String(query.seed).trim()
    : isNonEmptyString(replay.seed)
      ? String(replay.seed).trim()
      : "";

  if (!seed) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.REPLAY_SEED_MISSING,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Explicit replay seed required",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE21,
      })
    );
  }

  if (replay.lineageConflict === true || query.lineageConflict === true) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.REPLAY_LINEAGE_CONFLICT,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Conflicting event lineage blocks replay",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE21,
      })
    );
  }

  if (events.length > 0) {
    const ids = events.map((e) => String(e?.eventId || e?.id || ""));
    if (ids.some((id) => !id)) {
      issues.push(
        Object.freeze({
          code: RELIABILITY_ISSUE_CODE.REPLAY_LINEAGE_CONFLICT,
          severity: ISSUE_SEVERITY.BLOCKING,
          message: "Event lineage missing identities",
          sourceOwner: ISSUE_SOURCE_OWNER.CORE21,
        })
      );
    }
  }

  let canonicalSeed = null;
  let seedIdentity = null;
  let canonicalEventOrder = null;
  let sourceFingerprint = null;
  let planFingerprint = null;

  if (seed && issues.length === 0) {
    canonicalSeed = composeCanonicalSeed({
      seedNamespace: "competition-engine.e2e-06",
      purpose: "governance-replay-readiness",
      tenantId: record.tenantId,
      competitionId: record.competitionId,
      contextId: replay.target || query.target || "pool-knockout",
      ownerSeed: seed,
    });
    seedIdentity = createSeedIdentity({
      ownerSeed: seed,
      seedNamespace: "competition-engine.e2e-06",
      purpose: "governance-replay-readiness",
      tenantId: record.tenantId,
      competitionId: record.competitionId,
    });
    const orderedIds = sortStableIds(
      events.map((e) => String(e?.eventId || e?.id || "")).filter(Boolean)
    );
    canonicalEventOrder = orderedIds;
    sourceFingerprint = fingerprintValue({
      seed: canonicalSeed,
      events: orderedIds,
      sourceFingerprint: replay.sourceFingerprint || query.sourceFingerprint || null,
    });
    planFingerprint = computeGovernanceFingerprint(
      {
        canonicalSeed,
        seedIdentity: seedIdentity.seedIdentity,
        canonicalEventOrder: orderedIds,
        target: replay.target || query.target || "pool-knockout",
        sourceFingerprint,
      },
      "e2e06-replay-plan"
    );
  }

  const ready = issues.length === 0 && Boolean(canonicalSeed);
  const fingerprint = computeGovernanceFingerprint(
    {
      ready,
      issues: issues.map((i) => i.code),
      planFingerprint,
    },
    "e2e06-replay"
  );

  return deepFreeze({
    ready,
    blocked: !ready,
    issues,
    seedRequired: true,
    canonicalSeed,
    seedIdentity,
    canonicalEventOrder,
    sourceFingerprint,
    replayTarget: replay.target || query.target || "pool-knockout",
    inputImmutable: true,
    outputDeterministic: true,
    ownsReplayEngine: false,
    core21Handoff: true,
    planFingerprint,
    fingerprint,
  });
}
