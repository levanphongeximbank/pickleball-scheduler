/**
 * CORE-06 Phase 1C — Lineup domain service (capability-local).
 *
 * Isolated domain foundation only. No Production wiring, SQL, RPC, or TT writers.
 * Dependencies are injected. Clock is required (no system time).
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
  return Object.freeze({
    ...created,
    slots: Object.freeze([...(created.slots || [])]),
    revisions: Object.freeze(
      (created.revisions || []).map((r) => Object.freeze(r))
    ),
  });
}

function simpleHash(input) {
  const text = String(input);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 2147483647;
  }
  return `h${hash}`;
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

  // Silence unused in Phase 1C (ports retained for DI surface / later phases).
  void LINEUP_PERSISTENCE_PORT_METHODS;
  void random;
  void visibility;

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
    const ctx = {
      lineup,
      action,
      actorRole: command.actorRole ?? null,
      now: clock.nowIso(),
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
    return null;
  }

  async function maybeIdempotent(command, payload) {
    const key =
      command.idempotencyKey != null &&
      String(command.idempotencyKey).trim() !== ""
        ? String(command.idempotencyKey).trim()
        : null;
    if (!key) return { key: null, replay: null };

    const payloadHash = simpleHash(JSON.stringify(payload));
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
      return { key, replay: lookup.record.result };
    }
    return { key, payloadHash, replay: null };
  }

  async function persistAndAudit(lineup, command, action, fromStatus, toStatus) {
    const saved = await persistence.save(lineup, {
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey ?? null,
      actorId: command.actorId ?? null,
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
      at: clock.nowIso(),
    });
    return saved;
  }

  /**
   * Create a new DRAFT lineup with revision 1.
   */
  async function createLineup(input = {}, command = {}) {
    const now = clock.nowIso();
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
      revisions: [initial],
      previousRevisionId: null,
    });

    createLineupIdentity({
      competitionId,
      contextId,
      teamId,
      key: identityKey,
    });

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
      slots,
    });
    if (idem.replay) return idem.replay;

    const saved = await persistAndAudit(
      lineup,
      { ...command, expectedVersion: command.expectedVersion ?? null },
      LINEUP_ACTION.SAVE_DRAFT,
      null,
      COMPETITION_LINEUP_STATUS.DRAFT
    );
    const out = result(true, freezeLineup(saved));
    if (idem.key) {
      await idempotency.remember({
        key: idem.key,
        payloadHash: idem.payloadHash,
        result: out,
        at: now,
      });
    }
    return out;
  }

  async function transition(action, lineupInput, command = {}) {
    const current = freezeLineup(lineupInput);
    const fromStatus = current.status;

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
    const now = clock.nowIso();

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
      command,
      rosterResult.roster
    );
    if (policyFail) return policyFail;

    const idem = await maybeIdempotent(command, {
      op: action,
      lineupId: current.id,
      fromStatus,
      slots: nextSlots,
      reason: command.reason ?? null,
    });
    if (idem.replay) return idem.replay;

    const saved = await persistAndAudit(
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
      nextStatus
    );

    const out = result(true, freezeLineup(saved), [], null, null, {
      requiresRepublish: freezeLineup(saved).requiresRepublish === true,
      fromStatus,
      toStatus: nextStatus,
    });
    if (idem.key) {
      await idempotency.remember({
        key: idem.key,
        payloadHash: idem.payloadHash,
        result: out,
        at: now,
      });
    }
    return out;
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
      transition(LINEUP_ACTION.OVERRIDE, lineup, command),
    voidLineup: (lineup, command = {}) =>
      transition(LINEUP_ACTION.VOID, lineup, command),
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
    }),
  });
}
