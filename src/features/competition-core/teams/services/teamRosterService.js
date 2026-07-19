/**
 * Core-05 Phase 1 — Team & Roster management service (capability-local).
 *
 * In-memory only. No SQL / Supabase / RPC / Team Tournament writes.
 * Dependencies injected via explicit ports.
 */

import {
  createCompetitionTeam,
  createCompetitionRoster,
  createCompetitionRosterMember,
  createRosterSubstitutionReference,
} from "../../participants/contracts/teamRosterLineup.js";
import { createParticipantReference } from "../../participants/contracts/identity.js";
import {
  COMPETITION_TEAM_STATUS,
  COMPETITION_ROSTER_STATUS,
  COMPETITION_ROSTER_MEMBER_STATUS,
} from "../../participants/enums/statuses.js";
import { PARTICIPANT_REFERENCE_KIND } from "../../participants/enums/identityKinds.js";
import { buildTeamIdentityKey } from "../contracts/teamIdentity.js";
import { buildRosterIdentityKey } from "../contracts/rosterIdentity.js";
import {
  createTeamRosterSnapshot,
  buildRosterSnapshotContentHash,
} from "../contracts/rosterSnapshot.js";
import { TEAM_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { createInMemoryTeamRosterRepository } from "../repositories/inMemoryTeamRosterRepository.js";
import {
  TEAM_ROSTER_AUTH_ACTION,
  matchesAuthorizationAdapter,
  createDenyAuthorizationAdapter,
} from "../ports/authorizationAdapterPort.js";
import {
  matchesRuleAdapter,
  createDefaultDenyCrossTeamRuleAdapter,
} from "../ports/ruleAdapterPort.js";
import {
  matchesEligibilityAdapter,
  createFailClosedEligibilityAdapter,
} from "../ports/eligibilityAdapterPort.js";
import {
  matchesAuditAdapter,
  createNoopAuditAdapter,
} from "../ports/auditAdapterPort.js";
import {
  matchesClassificationAdapter,
  createOptionalClassificationAdapter,
} from "../ports/classificationAdapterPort.js";
import {
  sortDomainIssues,
  domainIssue,
  personTokenOf,
  listActiveMembers,
  validateRosterInvariants,
  validateRosterNotLocked,
  validateCaptainOnRoster,
  validateRosterSize,
  validateUniqueActiveMembers,
} from "./validateRosterInvariants.js";

/**
 * @param {boolean} ok
 * @param {unknown} [value]
 * @param {import('./validateRosterInvariants.js').DomainIssue[]} [issues]
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
    code: code || primary?.code || TEAM_RUNTIME_ERROR_CODE.INVALID_OPERATION,
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

function nowIso(clock) {
  if (typeof clock === "function") return String(clock());
  return new Date().toISOString();
}

function freezeTeam(team) {
  return Object.freeze(createCompetitionTeam(team));
}

function freezeRoster(roster) {
  return Object.freeze(createCompetitionRoster(roster));
}

function defaultRosterId(teamId) {
  return `roster:${String(teamId)}`;
}

function bumpVersion(roster) {
  const current =
    typeof roster?.rosterVersion === "number" && Number.isFinite(roster.rosterVersion)
      ? Math.floor(roster.rosterVersion)
      : 0;
  return current + 1;
}

function memberIdFor(teamId, person) {
  const token = personTokenOf(person) || "unknown";
  return `rm:${teamId}:${token.replace(":", "/")}`;
}

/**
 * @param {object} [options]
 */
export function createTeamRosterService(options = {}) {
  const repository =
    options.repository || createInMemoryTeamRosterRepository();
  const authorization = matchesAuthorizationAdapter(options.authorization)
    ? options.authorization
    : createDenyAuthorizationAdapter();
  const rules = matchesRuleAdapter(options.rules)
    ? options.rules
    : createDefaultDenyCrossTeamRuleAdapter();
  const eligibility = matchesEligibilityAdapter(options.eligibility)
    ? options.eligibility
    : createFailClosedEligibilityAdapter();
  const audit = matchesAuditAdapter(options.audit)
    ? options.audit
    : createNoopAuditAdapter();
  const classification = matchesClassificationAdapter(options.classification)
    ? options.classification
    : createOptionalClassificationAdapter();
  const clock = options.clock;

  async function requirements(context = {}) {
    return classification.resolveRequirements(context);
  }

  async function emitAudit(type, payload = {}) {
    await audit.record({
      type,
      at: nowIso(clock),
      teamId: payload.teamId ?? null,
      rosterId: payload.rosterId ?? null,
      actor: payload.actor ?? null,
      payload,
    });
  }

  async function assertEligibility(operation, team, roster, person, context = {}) {
    const request = { operation, team, roster, person, context };
    const required = await eligibility.isRequired(request);
    if (!required) return null;
    const decision = await eligibility.assertEligible(request);
    if (!decision || decision.ok !== true) {
      return fail(
        decision?.code || TEAM_RUNTIME_ERROR_CODE.ELIGIBILITY_REQUIRED,
        decision?.message || "Eligibility check failed — fail closed",
        [
          domainIssue(
            decision?.code || TEAM_RUNTIME_ERROR_CODE.ELIGIBILITY_DENIED,
            "eligibility",
            decision?.message || "Eligibility denied or missing"
          ),
        ]
      );
    }
    return null;
  }

  async function loadPair(teamId) {
    const team = await repository.getTeam(teamId);
    const roster = await repository.getRosterByTeamId(teamId);
    return { team, roster };
  }

  /**
   * @param {Partial<import('../../participants/contracts/teamRosterLineup.js').CompetitionTeam>} input
   */
  async function createTeam(input = {}) {
    const req = await requirements(input);
    const competitionId = String(input.competitionId || "").trim();
    const id = String(input.id || "").trim();
    if (!competitionId) {
      return fail(
        TEAM_RUNTIME_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
        "competitionId is required",
        [
          domainIssue(
            TEAM_RUNTIME_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
            "competitionId",
            "competitionId is required"
          ),
        ]
      );
    }
    if (!id) {
      return fail(TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM, "team id is required", [
        domainIssue(TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM, "id", "team id is required"),
      ]);
    }
    if (!String(input.name || "").trim()) {
      return fail(TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM, "team name is required", [
        domainIssue(TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM, "name", "team name is required"),
      ]);
    }

    const existing = await repository.getTeam(id);
    if (existing) {
      return fail(
        TEAM_RUNTIME_ERROR_CODE.TEAM_ALREADY_EXISTS,
        `Team ${id} already exists`,
        [
          domainIssue(
            TEAM_RUNTIME_ERROR_CODE.TEAM_ALREADY_EXISTS,
            "id",
            `Team ${id} already exists`
          ),
        ]
      );
    }

    const team = createCompetitionTeam({
      ...input,
      id,
      competitionId,
      status: input.status || COMPETITION_TEAM_STATUS.DRAFT,
      identityKey:
        input.identityKey ||
        buildTeamIdentityKey({ competitionId, stableTeamId: id }),
    });

    const isolation = validateRosterInvariants(team, null, req).filter(
      (i) => i.path !== "roster.teamId"
    );
    // validate with empty roster for context-only checks
    const contextIssues = [];
    if (req.requireTenantId && !team.tenantId) {
      contextIssues.push(
        domainIssue(
          TEAM_RUNTIME_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
          "tenantId",
          "tenantId is required by classification adapter"
        )
      );
    }
    if (req.requireDivisionId && !team.divisionId) {
      contextIssues.push(
        domainIssue(
          TEAM_RUNTIME_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
          "divisionId",
          "divisionId is required by classification adapter"
        )
      );
    }
    if (req.requireDivisionCategoryId && !team.divisionCategoryId) {
      contextIssues.push(
        domainIssue(
          TEAM_RUNTIME_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
          "divisionCategoryId",
          "divisionCategoryId is required by classification adapter"
        )
      );
    }
    if (contextIssues.length) {
      return result(false, null, contextIssues);
    }

    const roster = createCompetitionRoster({
      id: defaultRosterId(id),
      competitionId,
      teamId: id,
      tenantId: team.tenantId,
      divisionId: team.divisionId,
      divisionCategoryId: team.divisionCategoryId,
      members: [],
      status: COMPETITION_ROSTER_STATUS.DRAFT,
      minSize: typeof input.minSize === "number" ? input.minSize : null,
      maxSize: typeof input.maxSize === "number" ? input.maxSize : null,
      rosterVersion: 0,
      identityKey: buildRosterIdentityKey({ competitionId, teamId: id }),
    });

    const elig = await assertEligibility("createTeam", team, roster, null, input);
    if (elig) return elig;

    const savedTeam = freezeTeam(await repository.saveTeam(team));
    const savedRoster = freezeRoster(await repository.saveRoster(roster));
    await emitAudit("team.created", {
      teamId: savedTeam.id,
      rosterId: savedRoster.id,
      actor: input.actor || null,
    });

    return result(true, Object.freeze({ team: savedTeam, roster: savedRoster }), isolation);
  }

  async function updateTeam(teamId, patch = {}) {
    const id = String(teamId || "").trim();
    const { team, roster } = await loadPair(id);
    if (!team) {
      return fail(TEAM_RUNTIME_ERROR_CODE.TEAM_NOT_FOUND, `Team ${id} not found`);
    }

    // Identity fields are immutable
    if (patch.id != null && String(patch.id) !== String(team.id)) {
      return fail(
        TEAM_RUNTIME_ERROR_CODE.INVALID_OPERATION,
        "team id is immutable",
        [domainIssue(TEAM_RUNTIME_ERROR_CODE.INVALID_OPERATION, "id", "team id is immutable")]
      );
    }
    if (
      patch.competitionId != null &&
      String(patch.competitionId) !== String(team.competitionId)
    ) {
      return fail(
        TEAM_RUNTIME_ERROR_CODE.COMPETITION_MISMATCH,
        "competitionId is immutable",
        [
          domainIssue(
            TEAM_RUNTIME_ERROR_CODE.COMPETITION_MISMATCH,
            "competitionId",
            "competitionId is immutable"
          ),
        ]
      );
    }

    const next = createCompetitionTeam({
      ...team,
      ...patch,
      id: team.id,
      competitionId: team.competitionId,
      identityKey: team.identityKey,
      tenantId: patch.tenantId !== undefined ? patch.tenantId : team.tenantId,
      divisionId: patch.divisionId !== undefined ? patch.divisionId : team.divisionId,
      divisionCategoryId:
        patch.divisionCategoryId !== undefined
          ? patch.divisionCategoryId
          : team.divisionCategoryId,
      entryId: patch.entryId !== undefined ? patch.entryId : team.entryId,
    });

    const req = await requirements(patch);
    const issues = validateRosterInvariants(next, roster, req);
    if (issues.some((i) => i.code === TEAM_RUNTIME_ERROR_CODE.MISSING_REQUIRED_CONTEXT)) {
      return result(false, null, issues);
    }

    const saved = freezeTeam(await repository.saveTeam(next));
    // Keep roster scope in sync when division/tenant patched
    let savedRoster = roster;
    if (roster) {
      const rosterNext = createCompetitionRoster({
        ...roster,
        tenantId: saved.tenantId,
        divisionId: saved.divisionId,
        divisionCategoryId: saved.divisionCategoryId,
      });
      savedRoster = freezeRoster(await repository.saveRoster(rosterNext));
    }
    await emitAudit("team.updated", { teamId: saved.id, actor: patch.actor || null });
    return result(true, Object.freeze({ team: saved, roster: savedRoster }));
  }

  async function activateTeam(teamId, context = {}) {
    const id = String(teamId || "").trim();
    const { team, roster } = await loadPair(id);
    if (!team) {
      return fail(TEAM_RUNTIME_ERROR_CODE.TEAM_NOT_FOUND, `Team ${id} not found`);
    }
    const entryId =
      context.entryId != null
        ? String(context.entryId).trim()
        : team.entryId
          ? String(team.entryId).trim()
          : "";
    if (!entryId) {
      return fail(
        TEAM_RUNTIME_ERROR_CODE.ENTRY_ID_REQUIRED,
        "entryId is required before activateTeam",
        [
          domainIssue(
            TEAM_RUNTIME_ERROR_CODE.ENTRY_ID_REQUIRED,
            "entryId",
            "entryId is required before activateTeam"
          ),
        ]
      );
    }

    const elig = await assertEligibility("activateTeam", team, roster, null, context);
    if (elig) return elig;

    const next = createCompetitionTeam({
      ...team,
      entryId,
      status: COMPETITION_TEAM_STATUS.ACTIVE,
    });
    const issues = [
      ...validateCaptainOnRoster(next, roster),
      ...validateRosterSize(roster),
      ...validateUniqueActiveMembers(roster),
    ];
    if (issues.length) return result(false, null, issues);

    const saved = freezeTeam(await repository.saveTeam(next));
    await emitAudit("team.activated", {
      teamId: saved.id,
      entryId,
      actor: context.actor || null,
    });
    return result(true, Object.freeze({ team: saved, roster }));
  }

  async function withdrawTeam(teamId, context = {}) {
    const id = String(teamId || "").trim();
    const { team, roster } = await loadPair(id);
    if (!team) {
      return fail(TEAM_RUNTIME_ERROR_CODE.TEAM_NOT_FOUND, `Team ${id} not found`);
    }
    const next = createCompetitionTeam({
      ...team,
      status: COMPETITION_TEAM_STATUS.WITHDRAWN,
    });
    let nextRoster = roster;
    if (roster) {
      nextRoster = createCompetitionRoster({
        ...roster,
        status: COMPETITION_ROSTER_STATUS.WITHDRAWN,
        rosterVersion: bumpVersion(roster),
      });
      nextRoster = freezeRoster(
        await repository.saveRoster(nextRoster, {
          expectedVersion: roster.rosterVersion ?? 0,
        })
      );
    }
    const saved = freezeTeam(await repository.saveTeam(next));
    await emitAudit("team.withdrawn", {
      teamId: saved.id,
      reason: context.reason || null,
      actor: context.actor || null,
    });
    return result(true, Object.freeze({ team: saved, roster: nextRoster }));
  }

  function normalizePerson(person) {
    if (!person) return null;
    if (typeof person === "string") {
      return createParticipantReference({
        kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
        id: person,
      });
    }
    return createParticipantReference(person);
  }

  async function addRosterMember(teamId, personInput, context = {}) {
    const id = String(teamId || "").trim();
    const { team, roster } = await loadPair(id);
    if (!team || !roster) {
      return fail(
        team ? TEAM_RUNTIME_ERROR_CODE.ROSTER_NOT_FOUND : TEAM_RUNTIME_ERROR_CODE.TEAM_NOT_FOUND,
        team ? `Roster for team ${id} not found` : `Team ${id} not found`
      );
    }

    const locked = validateRosterNotLocked(roster);
    if (locked.length) return result(false, null, locked);

    const person = normalizePerson(personInput || context.person);
    const token = personTokenOf(person);
    if (!token) {
      return fail(
        TEAM_RUNTIME_ERROR_CODE.MISSING_PARTICIPANT_REF,
        "participant reference required",
        [
          domainIssue(
            TEAM_RUNTIME_ERROR_CODE.MISSING_PARTICIPANT_REF,
            "person",
            "participant reference required"
          ),
        ]
      );
    }

    // Idempotent: already active on this roster → success no version bump
    const existingActive = listActiveMembers(roster).find(
      (m) => personTokenOf(m.person) === token
    );
    if (existingActive) {
      return result(
        true,
        Object.freeze({
          team,
          roster: freezeRoster(roster),
          member: existingActive,
          idempotent: true,
        })
      );
    }

    const elig = await assertEligibility("addRosterMember", team, roster, person, context);
    if (elig) return elig;

    const otherTeamId = await repository.findActiveMembership({
      competitionId: team.competitionId,
      divisionId: team.divisionId,
      divisionCategoryId: team.divisionCategoryId,
      personToken: token,
    });
    if (otherTeamId && otherTeamId !== id) {
      const allowed = await rules.allowCrossTeamMembership({
        competitionId: team.competitionId,
        tenantId: team.tenantId,
        divisionId: team.divisionId,
        divisionCategoryId: team.divisionCategoryId,
        personToken: token,
        targetTeamId: id,
        existingTeamId: otherTeamId,
      });
      if (!allowed) {
        return fail(
          TEAM_RUNTIME_ERROR_CODE.CROSS_TEAM_MEMBERSHIP,
          `Participant ${token} already active on team ${otherTeamId}`,
          [
            domainIssue(
              TEAM_RUNTIME_ERROR_CODE.CROSS_TEAM_MEMBERSHIP,
              "person",
              `Participant ${token} already active on team ${otherTeamId}`
            ),
          ],
          { existingTeamId: otherTeamId }
        );
      }
    }

    const members = Array.isArray(roster.members) ? [...roster.members] : [];
    // Reactivate previously removed member if same person
    const priorIndex = members.findIndex((m) => personTokenOf(m.person) === token);
    const joinedAt = nowIso(clock);
    let member;
    if (priorIndex >= 0) {
      member = createCompetitionRosterMember({
        ...members[priorIndex],
        status: COMPETITION_ROSTER_MEMBER_STATUS.ACTIVE,
        removedAt: null,
        replacedMemberId: null,
        replacementReason: null,
        role: context.role || members[priorIndex].role || "player",
        joinedAt: members[priorIndex].joinedAt || joinedAt,
      });
      members[priorIndex] = member;
    } else {
      member = createCompetitionRosterMember({
        id: memberIdFor(id, person),
        rosterId: roster.id,
        person,
        status: COMPETITION_ROSTER_MEMBER_STATUS.ACTIVE,
        role: context.role || "player",
        joinedAt,
      });
      members.push(member);
    }

    const nextRoster = createCompetitionRoster({
      ...roster,
      members,
      rosterVersion: bumpVersion(roster),
      maxSize:
        typeof context.maxSize === "number" ? context.maxSize : roster.maxSize,
      minSize:
        typeof context.minSize === "number" ? context.minSize : roster.minSize,
    });

    const sizeIssues = validateRosterSize(nextRoster);
    if (sizeIssues.length) return result(false, null, sizeIssues);
    const dupIssues = validateUniqueActiveMembers(nextRoster);
    if (dupIssues.length) return result(false, null, dupIssues);

    const saved = freezeRoster(
      await repository.saveRoster(nextRoster, {
        expectedVersion: roster.rosterVersion ?? 0,
      })
    );
    await emitAudit("roster.member_added", {
      teamId: id,
      rosterId: saved.id,
      personToken: token,
      actor: context.actor || null,
    });
    return result(
      true,
      Object.freeze({ team, roster: saved, member, idempotent: false })
    );
  }

  async function removeRosterMember(teamId, personInput, context = {}) {
    const id = String(teamId || "").trim();
    const { team, roster } = await loadPair(id);
    if (!team || !roster) {
      return fail(
        team ? TEAM_RUNTIME_ERROR_CODE.ROSTER_NOT_FOUND : TEAM_RUNTIME_ERROR_CODE.TEAM_NOT_FOUND,
        team ? `Roster for team ${id} not found` : `Team ${id} not found`
      );
    }
    const locked = validateRosterNotLocked(roster);
    if (locked.length) return result(false, null, locked);

    const person = normalizePerson(personInput || context.person);
    const token = personTokenOf(person);
    if (!token) {
      return fail(
        TEAM_RUNTIME_ERROR_CODE.MISSING_PARTICIPANT_REF,
        "participant reference required"
      );
    }

    const members = Array.isArray(roster.members) ? [...roster.members] : [];
    const index = members.findIndex(
      (m) =>
        personTokenOf(m.person) === token &&
        m.status === COMPETITION_ROSTER_MEMBER_STATUS.ACTIVE
    );
    if (index < 0) {
      return fail(
        TEAM_RUNTIME_ERROR_CODE.INVALID_OPERATION,
        `Active member ${token} not found`,
        [
          domainIssue(
            TEAM_RUNTIME_ERROR_CODE.INVALID_OPERATION,
            "person",
            `Active member ${token} not found`
          ),
        ]
      );
    }

    const removedAt = nowIso(clock);
    members[index] = createCompetitionRosterMember({
      ...members[index],
      status: COMPETITION_ROSTER_MEMBER_STATUS.WITHDRAWN,
      removedAt,
      role: members[index].role === "captain" ? "player" : members[index].role,
    });

    let nextTeam = team;
    if (personTokenOf(team.captainRef) === token) {
      nextTeam = createCompetitionTeam({ ...team, captainRef: null });
      nextTeam = freezeTeam(await repository.saveTeam(nextTeam));
    }

    const nextRoster = createCompetitionRoster({
      ...roster,
      members,
      rosterVersion: bumpVersion(roster),
    });
    const saved = freezeRoster(
      await repository.saveRoster(nextRoster, {
        expectedVersion: roster.rosterVersion ?? 0,
      })
    );
    await emitAudit("roster.member_removed", {
      teamId: id,
      rosterId: saved.id,
      personToken: token,
      actor: context.actor || null,
    });
    return result(true, Object.freeze({ team: nextTeam, roster: saved }));
  }

  async function replaceRosterMember(teamId, replacedInput, replacementInput, context = {}) {
    const id = String(teamId || "").trim();
    const { team, roster } = await loadPair(id);
    if (!team || !roster) {
      return fail(
        team ? TEAM_RUNTIME_ERROR_CODE.ROSTER_NOT_FOUND : TEAM_RUNTIME_ERROR_CODE.TEAM_NOT_FOUND,
        team ? `Roster for team ${id} not found` : `Team ${id} not found`
      );
    }
    const locked = validateRosterNotLocked(roster);
    if (locked.length) return result(false, null, locked);

    const replacedPerson = normalizePerson(replacedInput);
    const replacementPerson = normalizePerson(replacementInput);
    const replacedToken = personTokenOf(replacedPerson);
    const replacementToken = personTokenOf(replacementPerson);
    if (!replacedToken || !replacementToken) {
      return fail(
        TEAM_RUNTIME_ERROR_CODE.MISSING_PARTICIPANT_REF,
        "replaced and replacement participant references required"
      );
    }

    const elig = await assertEligibility(
      "replaceRosterMember",
      team,
      roster,
      replacementPerson,
      context
    );
    if (elig) return elig;

    const otherTeamId = await repository.findActiveMembership({
      competitionId: team.competitionId,
      divisionId: team.divisionId,
      divisionCategoryId: team.divisionCategoryId,
      personToken: replacementToken,
    });
    if (otherTeamId && otherTeamId !== id) {
      const allowed = await rules.allowCrossTeamMembership({
        competitionId: team.competitionId,
        tenantId: team.tenantId,
        divisionId: team.divisionId,
        divisionCategoryId: team.divisionCategoryId,
        personToken: replacementToken,
        targetTeamId: id,
        existingTeamId: otherTeamId,
      });
      if (!allowed) {
        return fail(
          TEAM_RUNTIME_ERROR_CODE.CROSS_TEAM_MEMBERSHIP,
          `Participant ${replacementToken} already active on team ${otherTeamId}`,
          [
            domainIssue(
              TEAM_RUNTIME_ERROR_CODE.CROSS_TEAM_MEMBERSHIP,
              "replacement",
              `Participant ${replacementToken} already active on team ${otherTeamId}`
            ),
          ]
        );
      }
    }

    const members = Array.isArray(roster.members) ? [...roster.members] : [];
    const replacedIndex = members.findIndex(
      (m) =>
        personTokenOf(m.person) === replacedToken &&
        m.status === COMPETITION_ROSTER_MEMBER_STATUS.ACTIVE
    );
    if (replacedIndex < 0) {
      return fail(
        TEAM_RUNTIME_ERROR_CODE.INVALID_OPERATION,
        `Active member ${replacedToken} not found to replace`
      );
    }

    const reason = String(context.reason || "replacement");
    const at = nowIso(clock);
    const replacedMember = createCompetitionRosterMember({
      ...members[replacedIndex],
      status: COMPETITION_ROSTER_MEMBER_STATUS.REPLACED,
      removedAt: at,
      replacementReason: reason,
    });

    const newMember = createCompetitionRosterMember({
      id: memberIdFor(id, replacementPerson),
      rosterId: roster.id,
      person: replacementPerson,
      status: COMPETITION_ROSTER_MEMBER_STATUS.ACTIVE,
      role: context.role || "player",
      joinedAt: at,
      replacedMemberId: replacedMember.id,
      replacementReason: reason,
    });

    members[replacedIndex] = replacedMember;
    members.push(newMember);

    let nextTeam = team;
    if (personTokenOf(team.captainRef) === replacedToken) {
      nextTeam = createCompetitionTeam({
        ...team,
        captainRef: context.transferCaptain === true ? replacementPerson : null,
      });
      nextTeam = freezeTeam(await repository.saveTeam(nextTeam));
    }

    const amendments = [
      ...(Array.isArray(roster.amendments) ? roster.amendments : []),
      createRosterSubstitutionReference({
        id: `sub:${id}:${replacedMember.id}:${newMember.id}`,
        rosterId: roster.id,
        replaced: replacedPerson,
        replacement: replacementPerson,
        reason,
        requestedBy: context.actor || null,
        effectiveAt: at,
      }),
    ];

    const nextRoster = createCompetitionRoster({
      ...roster,
      members,
      amendments,
      status:
        roster.status === COMPETITION_ROSTER_STATUS.ROSTER_LOCKED
          ? roster.status
          : COMPETITION_ROSTER_STATUS.AMENDED,
      rosterVersion: bumpVersion(roster),
    });

    const sizeIssues = validateRosterSize(nextRoster);
    if (sizeIssues.length) return result(false, null, sizeIssues);

    const saved = freezeRoster(
      await repository.saveRoster(nextRoster, {
        expectedVersion: roster.rosterVersion ?? 0,
      })
    );
    await emitAudit("roster.member_replaced", {
      teamId: id,
      rosterId: saved.id,
      replacedToken,
      replacementToken,
      actor: context.actor || null,
    });
    return result(
      true,
      Object.freeze({
        team: nextTeam,
        roster: saved,
        replacedMember,
        replacementMember: newMember,
      })
    );
  }

  async function assignCaptain(teamId, personInput, context = {}) {
    const id = String(teamId || "").trim();
    const { team, roster } = await loadPair(id);
    if (!team || !roster) {
      return fail(
        team ? TEAM_RUNTIME_ERROR_CODE.ROSTER_NOT_FOUND : TEAM_RUNTIME_ERROR_CODE.TEAM_NOT_FOUND,
        team ? `Roster for team ${id} not found` : `Team ${id} not found`
      );
    }
    const locked = validateRosterNotLocked(roster);
    if (locked.length) return result(false, null, locked);

    const person = normalizePerson(personInput);
    const token = personTokenOf(person);
    if (!token) {
      return fail(
        TEAM_RUNTIME_ERROR_CODE.MISSING_PARTICIPANT_REF,
        "captain participant reference required"
      );
    }

    const active = listActiveMembers(roster).find(
      (m) => personTokenOf(m.person) === token
    );
    if (!active) {
      return fail(
        TEAM_RUNTIME_ERROR_CODE.CAPTAIN_NOT_ON_ROSTER,
        "Captain must be an active roster member",
        [
          domainIssue(
            TEAM_RUNTIME_ERROR_CODE.CAPTAIN_NOT_ON_ROSTER,
            "captainRef",
            "Captain must be an active roster member"
          ),
        ]
      );
    }

    const members = (roster.members || []).map((m) => {
      if (personTokenOf(m.person) === token) {
        return createCompetitionRosterMember({ ...m, role: "captain" });
      }
      if (m.role === "captain") {
        return createCompetitionRosterMember({ ...m, role: "player" });
      }
      return m;
    });

    const nextTeam = freezeTeam(
      await repository.saveTeam(
        createCompetitionTeam({ ...team, captainRef: person })
      )
    );
    const nextRoster = freezeRoster(
      await repository.saveRoster(
        createCompetitionRoster({
          ...roster,
          members,
          rosterVersion: bumpVersion(roster),
        }),
        { expectedVersion: roster.rosterVersion ?? 0 }
      )
    );
    await emitAudit("roster.captain_assigned", {
      teamId: id,
      personToken: token,
      actor: context.actor || null,
    });
    return result(true, Object.freeze({ team: nextTeam, roster: nextRoster }));
  }

  async function lockRoster(teamId, context = {}) {
    const id = String(teamId || "").trim();
    const { team, roster } = await loadPair(id);
    if (!team || !roster) {
      return fail(
        team ? TEAM_RUNTIME_ERROR_CODE.ROSTER_NOT_FOUND : TEAM_RUNTIME_ERROR_CODE.TEAM_NOT_FOUND,
        team ? `Roster for team ${id} not found` : `Team ${id} not found`
      );
    }
    if (roster.status === COMPETITION_ROSTER_STATUS.ROSTER_LOCKED) {
      return result(true, Object.freeze({ team, roster: freezeRoster(roster), idempotent: true }));
    }
    const sizeIssues = validateRosterSize(roster);
    const captainIssues = validateCaptainOnRoster(team, roster);
    const issues = [...sizeIssues, ...captainIssues];
    if (issues.length) return result(false, null, issues);

    const nextRoster = freezeRoster(
      await repository.saveRoster(
        createCompetitionRoster({
          ...roster,
          status: COMPETITION_ROSTER_STATUS.ROSTER_LOCKED,
          lockedAt: nowIso(clock),
          lockReason: context.reason || "ROSTER_LOCKED",
          rosterVersion: bumpVersion(roster),
        }),
        { expectedVersion: roster.rosterVersion ?? 0 }
      )
    );
    await emitAudit("roster.locked", {
      teamId: id,
      rosterId: nextRoster.id,
      actor: context.actor || null,
    });
    return result(true, Object.freeze({ team, roster: nextRoster, idempotent: false }));
  }

  async function unlockRoster(teamId, context = {}) {
    const id = String(teamId || "").trim();
    const { team, roster } = await loadPair(id);
    if (!team || !roster) {
      return fail(
        team ? TEAM_RUNTIME_ERROR_CODE.ROSTER_NOT_FOUND : TEAM_RUNTIME_ERROR_CODE.TEAM_NOT_FOUND,
        team ? `Roster for team ${id} not found` : `Team ${id} not found`
      );
    }

    const auth = await authorization.authorize({
      action: TEAM_ROSTER_AUTH_ACTION.TEAM_ROSTER_UNLOCK,
      actor: context.actor || null,
      team,
      roster,
      context,
    });
    if (!auth || auth.allowed !== true) {
      return fail(
        TEAM_RUNTIME_ERROR_CODE.TEAM_ROSTER_UNLOCK_DENIED,
        auth?.reason || "TEAM_ROSTER_UNLOCK authorization required",
        [
          domainIssue(
            TEAM_RUNTIME_ERROR_CODE.TEAM_ROSTER_UNLOCK_DENIED,
            "authorization",
            auth?.reason || "TEAM_ROSTER_UNLOCK authorization required"
          ),
        ]
      );
    }

    if (roster.status !== COMPETITION_ROSTER_STATUS.ROSTER_LOCKED) {
      return result(true, Object.freeze({ team, roster: freezeRoster(roster), idempotent: true }));
    }

    const nextRoster = freezeRoster(
      await repository.saveRoster(
        createCompetitionRoster({
          ...roster,
          status: COMPETITION_ROSTER_STATUS.DRAFT,
          lockedAt: null,
          lockReason: null,
          rosterVersion: bumpVersion(roster),
        }),
        { expectedVersion: roster.rosterVersion ?? 0 }
      )
    );
    await emitAudit("roster.unlocked", {
      teamId: id,
      rosterId: nextRoster.id,
      actor: context.actor || null,
    });
    return result(true, Object.freeze({ team, roster: nextRoster, idempotent: false }));
  }

  async function getTeam(teamId) {
    const team = await repository.getTeam(teamId);
    if (!team) {
      return fail(TEAM_RUNTIME_ERROR_CODE.TEAM_NOT_FOUND, `Team ${teamId} not found`);
    }
    return result(true, freezeTeam(team));
  }

  async function listTeams(filter = {}) {
    const teams = await repository.listTeams(filter);
    return result(
      true,
      Object.freeze(teams.map((t) => freezeTeam(t)))
    );
  }

  async function getActiveRoster(teamId) {
    const { team, roster } = await loadPair(teamId);
    if (!team || !roster) {
      return fail(
        team ? TEAM_RUNTIME_ERROR_CODE.ROSTER_NOT_FOUND : TEAM_RUNTIME_ERROR_CODE.TEAM_NOT_FOUND,
        team ? `Roster for team ${teamId} not found` : `Team ${teamId} not found`
      );
    }
    const activeMembers = listActiveMembers(roster);
    return result(
      true,
      Object.freeze({
        team: freezeTeam(team),
        roster: freezeRoster(roster),
        activeMembers: Object.freeze(activeMembers.map((m) => Object.freeze({ ...m }))),
      })
    );
  }

  async function getRosterVersion(teamId) {
    const roster = await repository.getRosterByTeamId(teamId);
    if (!roster) {
      return fail(
        TEAM_RUNTIME_ERROR_CODE.ROSTER_NOT_FOUND,
        `Roster for team ${teamId} not found`
      );
    }
    return result(true, {
      teamId: String(teamId),
      rosterVersion: roster.rosterVersion ?? 0,
    });
  }

  async function validateRoster(teamId, context = {}) {
    const { team, roster } = await loadPair(teamId);
    if (!team || !roster) {
      return fail(
        team ? TEAM_RUNTIME_ERROR_CODE.ROSTER_NOT_FOUND : TEAM_RUNTIME_ERROR_CODE.TEAM_NOT_FOUND,
        team ? `Roster for team ${teamId} not found` : `Team ${teamId} not found`
      );
    }
    const req = await requirements(context);
    const issues = validateRosterInvariants(team, roster, req);
    if (issues.length) return result(false, null, issues);
    return result(true, Object.freeze({ team: freezeTeam(team), roster: freezeRoster(roster) }));
  }

  async function createRosterSnapshot(teamId, context = {}) {
    const { team, roster } = await loadPair(teamId);
    if (!team || !roster) {
      return fail(
        team ? TEAM_RUNTIME_ERROR_CODE.ROSTER_NOT_FOUND : TEAM_RUNTIME_ERROR_CODE.TEAM_NOT_FOUND,
        team ? `Roster for team ${teamId} not found` : `Team ${teamId} not found`
      );
    }
    const memberIds = (roster.members || [])
      .map((m) => String(m.id || "").trim())
      .filter(Boolean)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const rosterVersion = roster.rosterVersion ?? 0;
    const snapshot = createTeamRosterSnapshot({
      id: `snap:${team.id}:v${rosterVersion}:${buildRosterSnapshotContentHash({
        rosterVersion,
        memberIds,
      })}`,
      teamId: team.id,
      rosterId: roster.id,
      rosterVersion,
      memberIds,
      effectiveAt: nowIso(clock),
      reason: context.reason || null,
      actor: context.actor || null,
    });
    const saved = await repository.saveSnapshot(snapshot);
    await emitAudit("roster.snapshot_created", {
      teamId: team.id,
      rosterId: roster.id,
      snapshotId: saved.id,
      actor: context.actor || null,
    });
    return result(true, saved);
  }

  return Object.freeze({
    createTeam,
    updateTeam,
    activateTeam,
    withdrawTeam,
    addRosterMember,
    removeRosterMember,
    replaceRosterMember,
    assignCaptain,
    lockRoster,
    unlockRoster,
    getTeam,
    listTeams,
    getActiveRoster,
    getRosterVersion,
    validateRoster,
    createRosterSnapshot,
    repository,
  });
}
