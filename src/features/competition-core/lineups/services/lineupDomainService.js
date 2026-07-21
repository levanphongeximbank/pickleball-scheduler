/**
 * CORE-06 Phase 1C + 1E — Lineup domain service (capability-local).
 *
 * Isolated domain foundation only. No Production wiring, SQL, RPC, or TT writers.
 * Dependencies are injected. Clock is required (no system time).
 * Phase 1E: visibility, deadlines, concurrency, idempotency, locked correction.
 */

import {
  createCompetitionLineup,
} from "../../participants/contracts/teamRosterLineup.js";
import { COMPETITION_LINEUP_STATUS } from "../../participants/enums/statuses.js";
import {
  buildLineupIdentityKey,
  createLineupIdentity,
} from "../contracts/lineupIdentity.js";
import {
  createLineupPolicyResult,
  isLineupPolicy,
} from "../contracts/lineupPolicy.js";
import {
  createDefaultLineupHardeningPolicy,
  isLineupHardeningPolicy,
} from "../contracts/lineupHardeningPolicy.js";
import { createLineupAuditMetadata } from "../contracts/auditMetadata.js";
import { createLineupIdempotencyRecord } from "../contracts/idempotencyRecord.js";
import {
  LINEUP_VISIBILITY_STATE,
  normalizeLineupVisibilityState,
} from "../contracts/lineupVisibilityState.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { LineupRuntimeError } from "../errors/LineupRuntimeError.js";
import { createNoopLineupPolicy } from "../policies/noopLineupPolicy.js";
import {
  LINEUP_PERSISTENCE_PORT_METHODS,
  matchesLineupPersistencePort,
  createInMemoryLineupPersistencePort,
} from "../ports/lineupPersistencePort.js";
import {
  LINEUP_AUTH_ACTION,
  matchesLineupAuthorizationPort,
  createDenyLineupAuthorizationPort,
} from "../ports/lineupAuthorizationPort.js";
import {
  matchesLineupClockPort,
} from "../ports/lineupClockPort.js";
import {
  matchesLineupVisibilityPort,
  createDenyLineupVisibilityPort,
} from "../ports/lineupVisibilityPort.js";
import {
  matchesLineupRandomPort,
  createNoopLineupRandomPort,
} from "../ports/lineupRandomPort.js";
import {
  matchesRosterLookupPort,
  createFailClosedRosterLookupPort,
} from "../ports/rosterLookupPort.js";
import {
  matchesLineupAuditPort,
  createNoopLineupAuditPort,
} from "../ports/lineupAuditPort.js";
import {
  matchesLineupIdempotencyPort,
  createNoopLineupIdempotencyPort,
} from "../ports/idempotencyPort.js";
import {
  evaluateDeadlinePhase,
  assertDeadlineAllowsMutation,
  resolveExplicitEvaluationTime,
} from "../deadlines/evaluateDeadline.js";
import {
  assertExpectedVersion,
  buildCommandFingerprint,
  buildResultFingerprint,
} from "../concurrency/assertExpectedVersion.js";
import { projectLineupForViewer } from "../visibility/projectLineupForViewer.js";
import { assertVisibilityTransitionAllowed } from "../visibility/visibilityTransitions.js";
import {
  LINEUP_ACTION,
  assertLineupTransitionAllowed,
} from "./transitions.js";
import {
  sortDomainIssues,
  domainIssue,
  validateLineupInvariants,
  validateRevisionImmutability,
} from "./validateLineupInvariants.js";
import {
  createInitialRevision,
  createNextRevision,
  supersedeRevision,
  appendRevisionHistory,
  normalizeSlotsWithDeterministicIds,
} from "./revisions.js";
import { assertLockedMutationAllowed } from "./lockedMutationGuard.js";
import {
  buildIdempotencyPayloadFingerprint,
} from "./idempotencyGuard.js";

/**
 * @param {boolean} ok
 * @param {unknown} [value]
 * @param {import('./validateLineupInvariants.js').DomainIssue[]} [issues]
 * @param {string} [code]
 * @param {string} [message]
 * @param {Record<string, unknown>} [details]
 */
function result(ok, value = null, issues = [], code = null, message = null, details = {}) {
  const sorted = sortDomainIssues(issues);
  if (ok) {
    return Object.freeze({
      ok: true,
      value: value == null ? null : value,
      issues: Object.freeze(sorted),
      code: null,
      message: null,
      details: Object.freeze({ ...details }),
    });
  }
  const primary = sorted[0];
  return Object.freeze({
    ok: false,
    value: null,
    issues: Object.freeze(sorted),
    code: code || primary?.code || LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
    message: message || primary?.message || "Operation failed",
    details: Object.freeze({ ...details }),
  });
}

function fail(code, message, issues = [], details = {}) {
  const merged = sortDomainIssues([
    ...issues,
    ...(issues.some((i) => i.code === code)
      ? []
      : [domainIssue(code, "", message)]),
  ]);
  return result(false, null, merged, code, message, details);
}

function freezeLineup(lineup) {
  const created = createCompetitionLineup(lineup);
  const visibilityState =
    normalizeLineupVisibilityState(lineup?.visibilityState) ||
    LINEUP_VISIBILITY_STATE.PRIVATE;
  return Object.freeze({
    ...created,
    visibilityState,
    slots: Object.freeze([...(created.slots || [])]),
    revisions: Object.freeze(
      (created.revisions || []).map((r) => Object.freeze(r))
    ),
  });
}

function evaluationTimeFrom(command = {}, clock) {
  return (
    resolveExplicitEvaluationTime(command) ||
    (clock && typeof clock.nowIso === "function" ? clock.nowIso() : null)
  );
}

function authActionFor(action) {
  switch (action) {
    case LINEUP_ACTION.SAVE_DRAFT:
      return LINEUP_AUTH_ACTION.DRAFT;
    case LINEUP_ACTION.SUBMIT:
      return LINEUP_AUTH_ACTION.SUBMIT;
    case LINEUP_ACTION.LOCK:
      return LINEUP_AUTH_ACTION.LOCK;
    case LINEUP_ACTION.PUBLISH:
      return LINEUP_AUTH_ACTION.PUBLISH;
    case LINEUP_ACTION.OVERRIDE:
      return LINEUP_AUTH_ACTION.OVERRIDE;
    case LINEUP_ACTION.VOID:
      return LINEUP_AUTH_ACTION.VOID;
    default:
      return action;
  }
}

/**
 * @param {object} [options]
 */
export function createLineupDomainService(options = {}) {
  if (!matchesLineupClockPort(options.clock)) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.LINEUP_CLOCK_REQUIRED,
      "createLineupDomainService requires an injected LineupClockPort",
      {}
    );
  }

  const clock = options.clock;
  const persistence = matchesLineupPersistencePort(options.persistence)
    ? options.persistence
    : createInMemoryLineupPersistencePort();
  const authorization = matchesLineupAuthorizationPort(options.authorization)
    ? options.authorization
    : createDenyLineupAuthorizationPort();
  const policy = isLineupPolicy(options.lineupPolicy)
    ? options.lineupPolicy
    : createNoopLineupPolicy();
  const visibility = matchesLineupVisibilityPort(options.visibility)
    ? options.visibility
    : createDenyLineupVisibilityPort();
  const random = matchesLineupRandomPort(options.random)
    ? options.random
    : createNoopLineupRandomPort();
  const rosterLookup = matchesRosterLookupPort(options.rosterLookup)
    ? options.rosterLookup
    : createFailClosedRosterLookupPort();
  const audit = matchesLineupAuditPort(options.audit)
    ? options.audit
    : createNoopLineupAuditPort();
  const idempotency = matchesLineupIdempotencyPort(options.idempotency)
    ? options.idempotency
    : createNoopLineupIdempotencyPort();
  const hardeningPolicy = isLineupHardeningPolicy(options.hardeningPolicy)
    ? options.hardeningPolicy
    : createDefaultLineupHardeningPolicy();

  // Phase 1C retained DI surface; Phase 1E wires visibility/hardening.
  void LINEUP_PERSISTENCE_PORT_METHODS;
  void random;

  function resolveDeadlineTimestamps(command = {}, lineup = null) {
    if (
      command.deadlineTimestamps &&
      typeof command.deadlineTimestamps === "object"
    ) {
      return command.deadlineTimestamps;
    }
    if (typeof hardeningPolicy.resolveDeadlineTimestamps === "function") {
      return hardeningPolicy.resolveDeadlineTimestamps({
        lineup,
        command,
        extras: command.context || {},
      });
    }
    return null;
  }

  async function enforceDeadline(action, lineup, command = {}, extras = {}) {
    const evaluatedAt = evaluationTimeFrom(command, clock);
    if (!evaluatedAt) {
      return fail(
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_CLOCK_REQUIRED,
        "Explicit evaluation time or injected clock is required"
      );
    }
    const timestamps = resolveDeadlineTimestamps(command, lineup);
    if (!timestamps) {
      // No deadline policy timestamps → do not invent; allow (format-owned).
      return { evaluatedAt, phaseResult: null, deadlineFail: null };
    }
    const phaseResult = evaluateDeadlinePhase({
      timestamps,
      evaluatedAt,
    });
    if (!phaseResult.ok) {
      return {
        evaluatedAt,
        phaseResult,
        deadlineFail: fail(phaseResult.code, phaseResult.message),
      };
    }
    const allowsLate =
      typeof hardeningPolicy.allowsLateMutation === "function"
        ? hardeningPolicy.allowsLateMutation({
            action,
            lineup,
            phase: phaseResult.phase,
            command,
          }) === true
        : false;
    const gate = assertDeadlineAllowsMutation({
      phase: phaseResult.phase,
      action,
      allowsLateMutation: allowsLate,
      correctionUntil: timestamps.correctionUntil ?? null,
      evaluatedAt,
      isCorrection: extras.isCorrection === true,
    });
    if (gate.ok !== true) {
      return {
        evaluatedAt,
        phaseResult,
        deadlineFail: fail(
          gate.code || LINEUP_RUNTIME_ERROR_CODE.LINEUP_MUTATION_NOT_ALLOWED,
          gate.message || "Deadline policy denied mutation",
          [],
          gate.details || {}
        ),
      };
    }
    return { evaluatedAt, phaseResult, deadlineFail: null };
  }

  async function enforceExpectedVersion(lineup, command = {}, action = null) {
    const required =
      typeof hardeningPolicy.requiresExpectedVersion === "function"
        ? hardeningPolicy.requiresExpectedVersion({
            lineup,
            command,
            action,
          }) === true
        : false;
    const check = assertExpectedVersion({
      expectedVersion: command.expectedVersion,
      currentVersion: lineup?.revision ?? null,
      required,
      aggregateIdentity: lineup?.identityKey ?? lineup?.id ?? null,
    });
    if (check.ok !== true) {
      return fail(
        check.code || LINEUP_RUNTIME_ERROR_CODE.LINEUP_VERSION_CONFLICT,
        check.message || "Version conflict",
        [],
        check.details || {}
      );
    }
    return null;
  }

  async function authorize(action, lineup, command = {}) {
    const decision = await authorization.authorize({
      action: authActionFor(action),
      actorId: command.actorId ?? null,
      actorRole: command.actorRole ?? null,
      lineup,
      context: command.context || {},
    });
    if (!decision || decision.allowed !== true) {
      return fail(
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_AUTHORIZATION_DENIED,
        decision?.reason || "Authorization denied",
        [],
        { action }
      );
    }
    return null;
  }

  async function resolveRoster(lineup, command = {}) {
    if (command.roster != null) {
      return { ok: true, roster: command.roster };
    }
    return rosterLookup.lookup({
      competitionId: lineup.competitionId,
      teamId: lineup.teamId,
      rosterId: lineup.rosterId,
      rosterVersion: lineup.rosterVersion,
      tenantId: lineup.tenantId,
    });
  }

  function allowDuplicatesFromPolicy(ctx) {
    if (typeof policy.allowsDuplicateParticipants === "function") {
      return policy.allowsDuplicateParticipants(ctx) === true;
    }
    return false;
  }

  async function runPolicy(lineup, action, command, roster) {
    const evaluatedAt = evaluationTimeFrom(command, clock);
    const ctx = {
      lineup,
      action,
      actorRole: command.actorRole ?? null,
      now: evaluatedAt,
      roster,
      extras: command.context || {},
    };
    if (typeof policy.validateSlots === "function") {
      const slotResult = await policy.validateSlots(ctx);
      const normalized = createLineupPolicyResult(slotResult);
      if (!normalized.ok) {
        return fail(
          normalized.code || LINEUP_RUNTIME_ERROR_CODE.LINEUP_SLOT_INELIGIBLE,
          normalized.message || "Lineup policy rejected slots",
          [
            domainIssue(
              normalized.code || LINEUP_RUNTIME_ERROR_CODE.LINEUP_SLOT_INELIGIBLE,
              "slots",
              normalized.message || "Lineup policy rejected slots",
              normalized.details
            ),
          ]
        );
      }
    }
    if (typeof policy.assertTransition === "function") {
      const transitionResult = await policy.assertTransition(ctx);
      const normalized = createLineupPolicyResult(transitionResult);
      if (!normalized.ok) {
        return fail(
          normalized.code ||
            LINEUP_RUNTIME_ERROR_CODE.LINEUP_STATE_TRANSITION_INVALID,
          normalized.message || "Lineup policy rejected transition",
          [
            domainIssue(
              normalized.code ||
                LINEUP_RUNTIME_ERROR_CODE.LINEUP_STATE_TRANSITION_INVALID,
              "status",
              normalized.message || "Lineup policy rejected transition",
              normalized.details
            ),
          ]
        );
      }
    }
    if (typeof policy.evaluateDeadline === "function") {
      const deadlineResult = await policy.evaluateDeadline(ctx);
      const normalized = createLineupPolicyResult(deadlineResult);
      if (!normalized.ok) {
        return fail(
          normalized.code ||
            LINEUP_RUNTIME_ERROR_CODE.LINEUP_SUBMISSION_DEADLINE_PASSED,
          normalized.message || "Lineup deadline policy rejected mutation",
          [
            domainIssue(
              normalized.code ||
                LINEUP_RUNTIME_ERROR_CODE.LINEUP_SUBMISSION_DEADLINE_PASSED,
              "deadline",
              normalized.message || "Lineup deadline policy rejected mutation",
              normalized.details
            ),
          ]
        );
      }
    }
    return null;
  }

  async function maybeIdempotent(command, payload) {
    const key =
      command.idempotencyKey != null &&
      String(command.idempotencyKey).trim() !== ""
        ? String(command.idempotencyKey).trim()
        : null;
    if (!key) return { key: null, replay: null };

    const aggregateIdentity =
      payload.aggregateIdentity ??
      payload.lineupIdentityKey ??
      payload.lineupId ??
      null;
    const commandType = payload.op ?? payload.commandType ?? null;
    const expectedVersion =
      command.expectedVersion != null &&
      Number.isInteger(Number(command.expectedVersion))
        ? Number(command.expectedVersion)
        : null;
    const commandFingerprint = buildCommandFingerprint({
      ...payload,
      commandType,
      aggregateIdentity,
      expectedVersion,
      actorId: command.actorId ?? null,
      actorRole: command.actorRole ?? null,
      source: command.source ?? null,
      reason: command.reason ?? null,
      slots: payload.slots,
    });
    const payloadHash = buildIdempotencyPayloadFingerprint({
      ...payload,
      commandFingerprint,
      expectedVersion,
      aggregateIdentity,
      commandType,
    });

    if (typeof idempotency.lookupContext === "function") {
      const lookup = await idempotency.lookupContext({
        idempotencyKey: key,
        aggregateIdentity,
        commandType,
        canonicalPayloadFingerprint: payloadHash,
        expectedVersion,
      });
      if (lookup?.conflict) {
        return {
          key,
          replay: fail(
            LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDEMPOTENCY_CONFLICT,
            lookup.message ||
              "Idempotency key reused with different context",
            [],
            { idempotencyKey: key }
          ),
        };
      }
      if (lookup?.found && lookup.record?.result) {
        const replayed =
          typeof idempotency.markReplayed === "function"
            ? idempotency.markReplayed(key)
            : lookup.record;
        const prior = lookup.record.result;
        if (prior && typeof prior === "object") {
          return {
            key,
            payloadHash,
            replay: Object.freeze({
              ...prior,
              details: Object.freeze({
                ...(prior.details && typeof prior.details === "object"
                  ? prior.details
                  : {}),
                replayed: true,
                idempotencyKey: key,
              }),
            }),
            record: replayed || lookup.record,
          };
        }
        return { key, payloadHash, replay: prior };
      }
      return {
        key,
        payloadHash,
        commandFingerprint,
        replay: null,
        claimed: lookup?.claimed === true,
      };
    }

    const lookup = await idempotency.lookup(key, payloadHash);
    if (lookup?.conflict) {
      return {
        key,
        replay: fail(
          LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDEMPOTENCY_CONFLICT,
          "Idempotency key reused with different payload",
          [],
          { idempotencyKey: key }
        ),
      };
    }
    if (lookup?.found && lookup.record?.result) {
      const prior = lookup.record.result;
      if (prior && typeof prior === "object") {
        return {
          key,
          payloadHash,
          commandFingerprint,
          replay: Object.freeze({
            ...prior,
            details: Object.freeze({
              ...(prior.details && typeof prior.details === "object"
                ? prior.details
                : {}),
              replayed: true,
              idempotencyKey: key,
            }),
          }),
        };
      }
      return { key, payloadHash, commandFingerprint, replay: prior };
    }
    return { key, payloadHash, commandFingerprint, replay: null };
  }

  async function persistAndAudit(lineup, command, action, fromStatus, toStatus, auditExtra = {}) {
    const saved = await persistence.save(lineup, {
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey ?? null,
      actorId: command.actorId ?? null,
    });
    const evaluatedAt = evaluationTimeFrom(command, clock) || clock.nowIso();
    const auditMeta = createLineupAuditMetadata({
      tenantId: saved.tenantId,
      competitionId: saved.competitionId,
      teamId: saved.teamId,
      lineupIdentityKey: saved.identityKey,
      previousVersion: auditExtra.previousVersion ?? null,
      resultingVersion: saved.revision,
      commandType: action,
      actor: {
        actorId: command.actorId ?? null,
        actorRole: command.actorRole ?? null,
      },
      source: command.source ?? null,
      idempotencyKey: command.idempotencyKey ?? null,
      commandFingerprint: auditExtra.commandFingerprint ?? null,
      resultFingerprint: auditExtra.resultFingerprint ?? null,
      evaluatedAt,
      reasonCode: auditExtra.reasonCode ?? null,
      correctionReason: auditExtra.correctionReason ?? command.reason ?? null,
    });
    await audit.append({
      type: "LINEUP_TRANSITION",
      lineupId: saved.id,
      identityKey: saved.identityKey,
      actorId: command.actorId ?? null,
      actorRole: command.actorRole ?? null,
      action,
      fromStatus,
      toStatus,
      revision: saved.revision,
      reason: command.reason ?? null,
      idempotencyKey: command.idempotencyKey ?? null,
      at: evaluatedAt,
      metadata: auditMeta,
    });
    return saved;
  }

  /**
   * Create a new DRAFT lineup with revision 1.
   */
  async function createLineup(input = {}, command = {}) {
    const now = evaluationTimeFrom(command, clock) || clock.nowIso();
    const competitionId = String(input.competitionId || "").trim();
    const teamId = String(input.teamId || "").trim();
    const contextId = String(input.contextId || "").trim();
    const identityKey = buildLineupIdentityKey({
      competitionId,
      contextId,
      teamId,
    });
    const slots = normalizeSlotsWithDeterministicIds(
      input.slots,
      identityKey
    );
    const lineupId =
      input.id != null && String(input.id).trim() !== ""
        ? String(input.id).trim()
        : identityKey;

    const initial = createInitialRevision({
      lineupId,
      revision: 1,
      status: COMPETITION_LINEUP_STATUS.DRAFT,
      slots,
      actorId: command.actorId ?? null,
      source: command.source ?? "core06",
      reason: command.reason ?? null,
      createdAt: now,
      lineupIdentityKey: identityKey,
    });

    const lineup = freezeLineup({
      ...input,
      id: lineupId,
      competitionId,
      teamId,
      contextId,
      tenantId: input.tenantId,
      rosterId: input.rosterId,
      rosterVersion: input.rosterVersion,
      status: COMPETITION_LINEUP_STATUS.DRAFT,
      revision: 1,
      slots,
      identityKey,
      requiresRepublish: false,
      visibilityState:
        normalizeLineupVisibilityState(input.visibilityState) ||
        LINEUP_VISIBILITY_STATE.PRIVATE,
      revisions: [initial],
      previousRevisionId: null,
    });

    createLineupIdentity({
      competitionId,
      contextId,
      teamId,
      key: identityKey,
    });

    const deadline = await enforceDeadline("createLineup", lineup, {
      ...command,
      evaluatedAt: now,
    });
    if (deadline.deadlineFail) return deadline.deadlineFail;

    const rosterResult = await resolveRoster(lineup, command);
    if (!rosterResult.ok) {
      return fail(
        rosterResult.code || LINEUP_RUNTIME_ERROR_CODE.LINEUP_ROSTER_MISMATCH,
        rosterResult.message || "Roster lookup failed"
      );
    }

    const allowDup = allowDuplicatesFromPolicy({
      lineup,
      action: LINEUP_ACTION.SAVE_DRAFT,
      roster: rosterResult.roster,
    });
    const issues = validateLineupInvariants(lineup, rosterResult.roster, {
      allowDuplicateParticipants: allowDup,
    });
    if (issues.length) {
      return result(false, null, issues);
    }

    const authFail = await authorize(LINEUP_ACTION.SAVE_DRAFT, lineup, command);
    if (authFail) return authFail;

    const idem = await maybeIdempotent(command, {
      op: "createLineup",
      lineupId,
      lineupIdentityKey: identityKey,
      aggregateIdentity: identityKey,
      slots,
    });
    if (idem.replay) return idem.replay;

    const saved = await persistAndAudit(
      lineup,
      { ...command, expectedVersion: command.expectedVersion ?? null },
      LINEUP_ACTION.SAVE_DRAFT,
      null,
      COMPETITION_LINEUP_STATUS.DRAFT,
      {
        previousVersion: null,
        commandFingerprint: idem.commandFingerprint ?? null,
      }
    );
    const out = result(true, freezeLineup(saved), [], null, null, {
      replayed: false,
    });
    if (idem.key) {
      const record = createLineupIdempotencyRecord({
        idempotencyKey: idem.key,
        aggregateIdentity: identityKey,
        commandType: "createLineup",
        canonicalPayloadFingerprint: idem.payloadHash,
        resultFingerprint: buildResultFingerprint(out),
        actor: {
          actorId: command.actorId ?? null,
          actorRole: command.actorRole ?? null,
        },
        source: command.source ?? null,
        expectedVersion:
          command.expectedVersion != null
            ? Number(command.expectedVersion)
            : null,
        resultingVersion: saved.revision,
        createdAt: now,
        replayed: false,
        result: out,
      });
      await idempotency.remember(
        typeof idempotency.lookupContext === "function"
          ? record
          : {
              key: idem.key,
              payloadHash: idem.payloadHash,
              result: out,
              at: now,
            }
      );
    }
    return out;
  }

  async function transition(action, lineupInput, command = {}) {
    const current = freezeLineup(lineupInput);
    const fromStatus = current.status;
    const previousVersion = current.revision;
    const isCorrection =
      action === LINEUP_ACTION.OVERRIDE || command.isCorrection === true;

    let transitionInfo;
    try {
      transitionInfo = assertLineupTransitionAllowed({
        action,
        fromStatus,
      });
    } catch (err) {
      if (err instanceof LineupRuntimeError) {
        return fail(err.code, err.message, [], err.details || {});
      }
      throw err;
    }

    const lockedGate = assertLockedMutationAllowed({
      lineup: current,
      action,
      isCorrection,
      correctionAuthorized:
        isCorrection &&
        typeof hardeningPolicy.allowsLockedCorrection === "function" &&
        hardeningPolicy.allowsLockedCorrection({
          lineup: current,
          command,
          action,
        }) === true,
      correctionReason: command.reason ?? null,
    });
    if (lockedGate.ok !== true) {
      return fail(
        lockedGate.code || LINEUP_RUNTIME_ERROR_CODE.LINEUP_MUTATION_NOT_ALLOWED,
        lockedGate.message || "Locked mutation denied",
        [],
        lockedGate.details || {}
      );
    }

    const versionFail = await enforceExpectedVersion(current, command, action);
    if (versionFail) return versionFail;

    const deadline = await enforceDeadline(action, current, command, {
      isCorrection,
    });
    if (deadline.deadlineFail) return deadline.deadlineFail;
    const now = deadline.evaluatedAt || clock.nowIso();

    const authFail = await authorize(action, current, command);
    if (authFail) return authFail;

    const rosterResult = await resolveRoster(current, command);
    if (!rosterResult.ok) {
      return fail(
        rosterResult.code || LINEUP_RUNTIME_ERROR_CODE.LINEUP_ROSTER_MISMATCH,
        rosterResult.message || "Roster lookup failed"
      );
    }

    const nextSlots =
      command.slots != null
        ? normalizeSlotsWithDeterministicIds(command.slots, current.identityKey)
        : current.slots;

    let nextStatus = transitionInfo.toStatus;
    let requiresRepublish = current.requiresRepublish === true;
    let publishedAt = current.publishedAt;
    let lockedAt = current.lockedAt;
    let submittedAt = current.submittedAt;
    let submittedBy = current.submittedBy;
    let reason = command.reason ?? current.reason;
    let revisions = current.revisions;
    let previousRevisionId = current.previousRevisionId;
    let revision = current.revision;
    let visibilityState = current.visibilityState;

    if (action === LINEUP_ACTION.OVERRIDE) {
      const overrideReason =
        command.reason != null ? String(command.reason).trim() : "";
      if (!overrideReason) {
        return fail(
          LINEUP_RUNTIME_ERROR_CODE.LINEUP_OVERRIDE_REASON_REQUIRED,
          "Override requires a reason"
        );
      }

      const head =
        revisions[revisions.length - 1] ||
        createInitialRevision({
          lineupId: current.id,
          revision: current.revision,
          status: current.status,
          slots: current.slots,
          createdAt: now,
          lineupIdentityKey: current.identityKey,
          actorId: current.submittedBy,
        });

      const immutabilityIssues = validateRevisionImmutability(head, {
        ...head,
        status: COMPETITION_LINEUP_STATUS.DRAFT,
      });
      // Prove immutability helper detects mutation attempts against protected heads.
      void immutabilityIssues;

      const superseded = supersedeRevision(head, {
        reason: overrideReason,
        actorId: command.actorId ?? null,
        createdAt: now,
      });

      const nextRev = createNextRevision({
        previous: superseded,
        status: COMPETITION_LINEUP_STATUS.LOCKED,
        slots: nextSlots,
        actorId: command.actorId ?? null,
        source: command.source ?? "override",
        reason: overrideReason,
        createdAt: now,
        lockedAt: now,
        lineupIdentityKey: current.identityKey,
      });

      revisions = appendRevisionHistory(
        [...revisions.slice(0, -1), superseded],
        nextRev
      );
      nextStatus = COMPETITION_LINEUP_STATUS.LOCKED;
      revision = nextRev.revision;
      previousRevisionId = superseded.id;
      lockedAt = now;
      publishedAt = null;
      requiresRepublish = true;
      reason = overrideReason;
    } else {
      if (
        action === LINEUP_ACTION.SAVE_DRAFT ||
        action === LINEUP_ACTION.SUBMIT
      ) {
        const head =
          revisions[revisions.length - 1] ||
          createInitialRevision({
            lineupId: current.id,
            revision: current.revision,
            status: current.status,
            slots: current.slots,
            createdAt: now,
            lineupIdentityKey: current.identityKey,
          });
        const nextRev = createNextRevision({
          previous: head,
          status: nextStatus,
          slots: nextSlots,
          actorId: command.actorId ?? null,
          source: command.source ?? action,
          reason: command.reason ?? null,
          createdAt: now,
          submittedAt:
            action === LINEUP_ACTION.SUBMIT ? now : head.submittedAt,
          submittedBy:
            action === LINEUP_ACTION.SUBMIT
              ? command.actorId ?? null
              : head.submittedBy,
          lockedAt: head.lockedAt,
          publishedAt: head.publishedAt,
          lineupIdentityKey: current.identityKey,
        });
        revisions = appendRevisionHistory(revisions, nextRev);
        revision = nextRev.revision;
        previousRevisionId = head.id;
        if (action === LINEUP_ACTION.SUBMIT) {
          submittedAt = now;
          submittedBy = command.actorId ?? null;
        }
      } else if (action === LINEUP_ACTION.LOCK) {
        lockedAt = now;
        const head = revisions[revisions.length - 1];
        if (head) {
          const lockedRev = Object.freeze({
            ...head,
            status: COMPETITION_LINEUP_STATUS.LOCKED,
            lockedAt: now,
            actorId: command.actorId ?? head.actorId,
            slots: nextSlots,
          });
          // Replace head snapshot only when still mutable draft/submitted lineage:
          // append a lock revision instead of mutating.
          const nextRev = createNextRevision({
            previous: head,
            status: COMPETITION_LINEUP_STATUS.LOCKED,
            slots: nextSlots,
            actorId: command.actorId ?? null,
            source: command.source ?? action,
            reason: command.reason ?? null,
            createdAt: now,
            submittedAt: head.submittedAt,
            submittedBy: head.submittedBy,
            lockedAt: now,
            lineupIdentityKey: current.identityKey,
          });
          void lockedRev;
          revisions = appendRevisionHistory(revisions, nextRev);
          revision = nextRev.revision;
          previousRevisionId = head.id;
        }
      } else if (action === LINEUP_ACTION.PUBLISH) {
        publishedAt = now;
        requiresRepublish = false;
        const head = revisions[revisions.length - 1];
        if (head) {
          const nextRev = createNextRevision({
            previous: head,
            status: COMPETITION_LINEUP_STATUS.PUBLISHED,
            slots: nextSlots,
            actorId: command.actorId ?? null,
            source: command.source ?? action,
            reason: command.reason ?? null,
            createdAt: now,
            submittedAt: head.submittedAt,
            submittedBy: head.submittedBy,
            lockedAt: head.lockedAt ?? lockedAt,
            publishedAt: now,
            lineupIdentityKey: current.identityKey,
          });
          revisions = appendRevisionHistory(revisions, nextRev);
          revision = nextRev.revision;
          previousRevisionId = head.id;
        }
      } else if (action === LINEUP_ACTION.VOID) {
        const head = revisions[revisions.length - 1];
        if (head) {
          const nextRev = createNextRevision({
            previous: head,
            status: COMPETITION_LINEUP_STATUS.VOIDED,
            slots: nextSlots,
            actorId: command.actorId ?? null,
            source: command.source ?? action,
            reason: command.reason ?? null,
            createdAt: now,
            submittedAt: head.submittedAt,
            submittedBy: head.submittedBy,
            lockedAt: head.lockedAt,
            publishedAt: head.publishedAt,
            lineupIdentityKey: current.identityKey,
          });
          revisions = appendRevisionHistory(revisions, nextRev);
          revision = nextRev.revision;
          previousRevisionId = head.id;
        }
      }
    }

    const nextLineup = freezeLineup({
      ...current,
      status: nextStatus,
      revision,
      slots: nextSlots,
      revisions,
      previousRevisionId,
      submittedAt,
      submittedBy,
      lockedAt,
      publishedAt,
      reason,
      requiresRepublish,
      visibilityState,
    });

    const allowDup = allowDuplicatesFromPolicy({
      lineup: nextLineup,
      action,
      roster: rosterResult.roster,
    });
    const issues = validateLineupInvariants(
      nextLineup,
      rosterResult.roster,
      { allowDuplicateParticipants: allowDup }
    );
    if (issues.length) {
      return result(false, null, issues);
    }

    const policyFail = await runPolicy(
      nextLineup,
      action,
      { ...command, evaluatedAt: now },
      rosterResult.roster
    );
    if (policyFail) return policyFail;

    const idem = await maybeIdempotent(command, {
      op: action,
      lineupId: current.id,
      lineupIdentityKey: current.identityKey,
      aggregateIdentity: current.identityKey,
      fromStatus,
      slots: nextSlots,
      reason: command.reason ?? null,
      expectedVersion:
        command.expectedVersion != null
          ? Number(command.expectedVersion)
          : null,
    });
    if (idem.replay) return idem.replay;

    let saved;
    try {
      saved = await persistAndAudit(
        nextLineup,
        {
          ...command,
          expectedVersion:
            command.expectedVersion != null
              ? command.expectedVersion
              : current.revision,
        },
        action,
        fromStatus,
        nextStatus,
        {
          previousVersion,
          commandFingerprint: idem.commandFingerprint ?? null,
          correctionReason: isCorrection ? command.reason ?? null : null,
          reasonCode: null,
        }
      );
    } catch (err) {
      if (idem.claimed && typeof idempotency.release === "function") {
        idempotency.release(idem.key);
      }
      if (err instanceof LineupRuntimeError) {
        return fail(err.code, err.message, [], err.details || {});
      }
      throw err;
    }

    const frozenSaved = freezeLineup(saved);
    const out = result(true, frozenSaved, [], null, null, {
      requiresRepublish: frozenSaved.requiresRepublish === true,
      fromStatus,
      toStatus: nextStatus,
      previousVersion,
      resultingVersion: frozenSaved.revision,
      replayed: false,
    });
    if (idem.key) {
      const record = createLineupIdempotencyRecord({
        idempotencyKey: idem.key,
        aggregateIdentity: current.identityKey,
        commandType: action,
        canonicalPayloadFingerprint: idem.payloadHash,
        resultFingerprint: buildResultFingerprint(out),
        actor: {
          actorId: command.actorId ?? null,
          actorRole: command.actorRole ?? null,
        },
        source: command.source ?? null,
        expectedVersion:
          command.expectedVersion != null
            ? Number(command.expectedVersion)
            : current.revision,
        resultingVersion: frozenSaved.revision,
        createdAt: now,
        replayed: false,
        result: out,
      });
      await idempotency.remember(
        typeof idempotency.lookupContext === "function"
          ? record
          : {
              key: idem.key,
              payloadHash: idem.payloadHash,
              result: out,
              at: now,
            }
      );
    }
    return out;
  }

  /**
   * Fail-closed visibility projection (Phase 1E).
   */
  function projectForViewer(request = {}) {
    return projectLineupForViewer({
      ...request,
      visibilityPolicy: request.visibilityPolicy || hardeningPolicy,
      evaluatedAt:
        resolveExplicitEvaluationTime(request) || clock.nowIso(),
    });
  }

  /**
   * Explicit visibility transition — never inferred from lifecycle alone.
   */
  async function transitionVisibility(lineupInput, command = {}) {
    const current = freezeLineup(lineupInput);
    const from =
      normalizeLineupVisibilityState(current.visibilityState) ||
      LINEUP_VISIBILITY_STATE.PRIVATE;
    const to = normalizeLineupVisibilityState(command.toVisibilityState);
    if (!to) {
      return fail(
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_VISIBILITY_TRANSITION_NOT_ALLOWED,
        "Target visibility state is required"
      );
    }

    const versionFail = await enforceExpectedVersion(
      current,
      command,
      "transition_visibility"
    );
    if (versionFail) return versionFail;

    const evaluatedAt = evaluationTimeFrom(command, clock) || clock.nowIso();
    const timestamps = resolveDeadlineTimestamps(command, current);
    const phaseResult = timestamps
      ? evaluateDeadlinePhase({ timestamps, evaluatedAt })
      : { ok: true, revealEligible: false, phase: null };
    if (phaseResult.ok === false) {
      return fail(phaseResult.code, phaseResult.message);
    }

    const revealAuthorized =
      typeof hardeningPolicy.allowsReveal === "function"
        ? hardeningPolicy.allowsReveal({
            from,
            to,
            lineup: current,
            command,
          }) === true
        : false;

    const gate = assertVisibilityTransitionAllowed({
      from,
      to,
      policy: hardeningPolicy,
      revealAuthorized,
      revealReady: timestamps
        ? phaseResult.revealEligible === true
        : revealAuthorized,
    });
    // PUBLIC / OPPONENT_VISIBLE still need revealReady from deadline when timestamps exist.
    if (
      timestamps &&
      (to === LINEUP_VISIBILITY_STATE.OPPONENT_VISIBLE ||
        to === LINEUP_VISIBILITY_STATE.PUBLIC) &&
      phaseResult.revealEligible !== true
    ) {
      return fail(
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_REVEAL_NOT_AUTHORIZED,
        "Reveal/public visibility is not eligible yet",
        [],
        { from, to, revealAt: timestamps.revealAt ?? null, evaluatedAt }
      );
    }
    if (gate.ok !== true) {
      return fail(
        gate.code ||
          LINEUP_RUNTIME_ERROR_CODE.LINEUP_VISIBILITY_TRANSITION_NOT_ALLOWED,
        gate.message || "Visibility transition denied",
        [],
        gate.details || {}
      );
    }

    const previousVersion = current.revision;
    const nextRevision = previousVersion + 1;
    const nextLineup = freezeLineup({
      ...current,
      visibilityState: to,
      revision: nextRevision,
    });

    const idem = await maybeIdempotent(command, {
      op: "transition_visibility",
      lineupId: current.id,
      aggregateIdentity: current.identityKey,
      from,
      to,
      expectedVersion: command.expectedVersion ?? previousVersion,
    });
    if (idem.replay) return idem.replay;

    let saved;
    try {
      saved = await persistAndAudit(
        nextLineup,
        {
          ...command,
          expectedVersion:
            command.expectedVersion != null
              ? command.expectedVersion
              : previousVersion,
        },
        "transition_visibility",
        current.status,
        current.status,
        {
          previousVersion,
          commandFingerprint: idem.commandFingerprint ?? null,
          reasonCode: null,
        }
      );
    } catch (err) {
      if (idem.claimed && typeof idempotency.release === "function") {
        idempotency.release(idem.key);
      }
      if (err instanceof LineupRuntimeError) {
        return fail(err.code, err.message, [], err.details || {});
      }
      throw err;
    }

    const out = result(true, freezeLineup(saved), [], null, null, {
      fromVisibility: from,
      toVisibility: to,
      previousVersion,
      resultingVersion: freezeLineup(saved).revision,
      replayed: false,
    });
    if (idem.key) {
      await idempotency.remember({
        key: idem.key,
        payloadHash: idem.payloadHash,
        result: out,
        at: evaluatedAt,
      });
    }
    return out;
  }

  /**
   * Explicit locked correction workflow (policy-authorized).
   */
  async function correctLockedLineup(lineupInput, command = {}) {
    return transition(LINEUP_ACTION.OVERRIDE, lineupInput, {
      ...command,
      isCorrection: true,
    });
  }

  /**
   * Explicit guard for random fallback overwrite attempts.
   */
  function assertRandomOverwriteAllowed(lineupInput, command = {}) {
    const current = freezeLineup(lineupInput);
    const gate = assertLockedMutationAllowed({
      lineup: current,
      action: "random_overwrite",
      isCorrection: false,
      correctionAuthorized: false,
      correctionReason: command.reason ?? null,
    });
    if (gate.ok !== true) {
      return fail(
        gate.code || LINEUP_RUNTIME_ERROR_CODE.LINEUP_ALREADY_LOCKED,
        gate.message || "Random overwrite blocked",
        [],
        gate.details || {}
      );
    }
    return result(true, current);
  }

  return Object.freeze({
    createLineup,
    saveDraft: (lineup, command = {}) =>
      transition(LINEUP_ACTION.SAVE_DRAFT, lineup, command),
    submit: (lineup, command = {}) =>
      transition(LINEUP_ACTION.SUBMIT, lineup, command),
    lock: (lineup, command = {}) =>
      transition(LINEUP_ACTION.LOCK, lineup, command),
    publish: (lineup, command = {}) =>
      transition(LINEUP_ACTION.PUBLISH, lineup, command),
    override: (lineup, command = {}) =>
      transition(LINEUP_ACTION.OVERRIDE, lineup, {
        ...command,
        isCorrection: true,
      }),
    voidLineup: (lineup, command = {}) =>
      transition(LINEUP_ACTION.VOID, lineup, command),
    correctLockedLineup,
    transitionVisibility,
    projectLineupForViewer: projectForViewer,
    assertRandomOverwriteAllowed,
    validateInvariants: async (lineup, command = {}) => {
      const rosterResult = await resolveRoster(lineup, command);
      if (!rosterResult.ok) {
        return fail(
          rosterResult.code || LINEUP_RUNTIME_ERROR_CODE.LINEUP_ROSTER_MISMATCH,
          rosterResult.message || "Roster lookup failed"
        );
      }
      const allowDup = allowDuplicatesFromPolicy({
        lineup,
        roster: rosterResult.roster,
      });
      const issues = validateLineupInvariants(lineup, rosterResult.roster, {
        allowDuplicateParticipants: allowDup,
      });
      if (issues.length) return result(false, null, issues);
      return result(true, freezeLineup(lineup));
    },
    assertTransition: assertLineupTransitionAllowed,
    ports: Object.freeze({
      persistence,
      authorization,
      policy,
      visibility,
      clock,
      random,
      rosterLookup,
      audit,
      idempotency,
      hardeningPolicy,
    }),
  });
}
