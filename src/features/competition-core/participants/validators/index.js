import { PARTICIPANT_ERROR_CODE } from "../errors/errorCodes.js";
import {
  isParticipantReferenceKind,
  isCompetitionParticipantStatus,
  isCompetitionRegistrationStatus,
  isCompetitionEntryStatus,
  isEligibilityDecisionStatus,
  isCompetitionRosterStatus,
  isCompetitionRosterMemberStatus,
  isCompetitionLineupStatus,
  isCompetitionTeamStatus,
  ACTIVE_ENTRY_STATUSES,
  COMPETITION_REGISTRATION_STATUS,
  COMPETITION_ROSTER_STATUS,
  COMPETITION_LINEUP_STATUS,
  COMPETITION_ENTRY_STATUS,
} from "../enums/index.js";
import {
  isNonEmptyString,
  isSchemaVersionV1,
  isJsonSafe,
} from "../contracts/shared.js";
import {
  validationError,
  validationFail,
  validationOk,
  createParticipantValidationResult,
} from "../results/validationResult.js";

/**
 * @param {unknown} value
 * @param {string} path
 * @param {import('../results/validationResult.js').ParticipantValidationIssue[]} errors
 */
function requireNonEmptyString(value, path, errors, code = PARTICIPANT_ERROR_CODE.REQUIRED) {
  if (!isNonEmptyString(value)) {
    errors.push(validationError(code, path, `${path} is required`));
  }
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {(v: unknown) => boolean} isValid
 * @param {import('../results/validationResult.js').ParticipantValidationIssue[]} errors
 * @param {string} code
 * @param {string} message
 */
function requireEnum(value, path, isValid, errors, code, message) {
  if (!isValid(value)) {
    errors.push(validationError(code, path, message, { value }));
  }
}

/**
 * @param {unknown} input
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateParticipantReference(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return validationFail([
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "ParticipantReference must be an object"),
    ]);
  }
  if (!isSchemaVersionV1(input.schemaVersion) && input.schemaVersion != null) {
    errors.push(
      validationError(
        PARTICIPANT_ERROR_CODE.INVALID_SCHEMA_VERSION,
        "schemaVersion",
        "Unsupported schemaVersion"
      )
    );
  }
  requireEnum(
    input.kind,
    "kind",
    isParticipantReferenceKind,
    errors,
    PARTICIPANT_ERROR_CODE.INVALID_KIND,
    "Invalid ParticipantReference.kind"
  );
  requireNonEmptyString(input.id, "id", errors);
  if (input.aliases != null && !Array.isArray(input.aliases)) {
    errors.push(
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "aliases", "aliases must be an array")
    );
  }
  return errors.length ? validationFail(errors) : validationOk();
}

/**
 * @param {unknown} input
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateCompetitionParticipant(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return validationFail([
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "CompetitionParticipant must be an object"),
    ]);
  }
  if (input.schemaVersion != null && !isSchemaVersionV1(input.schemaVersion)) {
    errors.push(
      validationError(
        PARTICIPANT_ERROR_CODE.INVALID_SCHEMA_VERSION,
        "schemaVersion",
        "Unsupported schemaVersion"
      )
    );
  }
  requireNonEmptyString(input.id, "id", errors);
  requireNonEmptyString(input.competitionId, "competitionId", errors);
  requireEnum(
    input.status,
    "status",
    isCompetitionParticipantStatus,
    errors,
    PARTICIPANT_ERROR_CODE.INVALID_STATUS,
    "Invalid CompetitionParticipant.status"
  );
  const personResult = validateParticipantReference(input.person);
  if (!personResult.valid) {
    for (const err of personResult.errors) {
      errors.push({ ...err, path: `person.${err.path}`.replace(/\.$/, "") });
    }
  }
  return errors.length ? validationFail(errors) : validationOk();
}

/**
 * @param {unknown} input
 * @param {{ requireDivisionId?: boolean, requireCategoryId?: boolean, requireEntryRole?: boolean }} [context]
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateCompetitionEntry(input, context = {}) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return validationFail([
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "CompetitionEntry must be an object"),
    ]);
  }
  if (input.schemaVersion != null && !isSchemaVersionV1(input.schemaVersion)) {
    errors.push(
      validationError(
        PARTICIPANT_ERROR_CODE.INVALID_SCHEMA_VERSION,
        "schemaVersion",
        "Unsupported schemaVersion"
      )
    );
  }
  requireNonEmptyString(input.id, "id", errors);
  if (!isNonEmptyString(input.competitionId)) {
    errors.push(
      validationError(
        PARTICIPANT_ERROR_CODE.MISSING_COMPETITION_ID,
        "competitionId",
        "CompetitionEntry.competitionId is required (OD-03)"
      )
    );
  }
  requireEnum(
    input.status,
    "status",
    isCompetitionEntryStatus,
    errors,
    PARTICIPANT_ERROR_CODE.INVALID_STATUS,
    "Invalid CompetitionEntry.status"
  );
  if (!Array.isArray(input.memberRefs) || input.memberRefs.length < 1) {
    errors.push(
      validationError(
        PARTICIPANT_ERROR_CODE.REQUIRED,
        "memberRefs",
        "CompetitionEntry.memberRefs must contain at least one reference"
      )
    );
  } else {
    input.memberRefs.forEach((ref, index) => {
      const result = validateParticipantReference(ref);
      if (!result.valid) {
        for (const err of result.errors) {
          errors.push({ ...err, path: `memberRefs[${index}].${err.path}`.replace(/\.$/, "") });
        }
      }
    });
  }
  if (context.requireDivisionId) {
    requireNonEmptyString(input.divisionId, "divisionId", errors);
  }
  if (context.requireCategoryId) {
    requireNonEmptyString(input.categoryId, "categoryId", errors);
  }
  if (context.requireEntryRole) {
    requireNonEmptyString(input.entryRole, "entryRole", errors);
  }
  return errors.length ? validationFail(errors) : validationOk();
}

/**
 * OD-02 default uniqueness for active entries.
 * Format exceptions must pass `allowDuplicateScope: true` explicitly.
 *
 * @param {unknown[]} entries
 * @param {{ allowDuplicateScope?: boolean }} [policy]
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function detectDuplicateActiveEntryScopes(entries, policy = {}) {
  if (policy.allowDuplicateScope === true) {
    return validationOk();
  }
  if (!Array.isArray(entries)) {
    return validationFail([
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "entries must be an array"),
    ]);
  }
  const errors = [];
  /** @type {Map<string, string>} */
  const seen = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    if (!ACTIVE_ENTRY_STATUSES.includes(entry.status)) continue;
    const key = [
      String(entry.competitionId || ""),
      String(entry.divisionId ?? ""),
      String(entry.categoryId ?? ""),
      String(entry.entryRole ?? ""),
    ].join("|");
    if (seen.has(key)) {
      errors.push(
        validationError(
          PARTICIPANT_ERROR_CODE.DUPLICATE_ENTRY_SCOPE,
          "entryScope",
          "Duplicate active entry for competition+division+category+entryRole",
          {
            competitionId: entry.competitionId,
            divisionId: entry.divisionId ?? null,
            categoryId: entry.categoryId ?? null,
            entryRole: entry.entryRole ?? null,
            existingEntryId: seen.get(key),
            duplicateEntryId: entry.id,
          }
        )
      );
    } else {
      seen.set(key, String(entry.id || ""));
    }
  }
  return errors.length ? validationFail(errors) : validationOk();
}

/**
 * @param {unknown} input
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateCompetitionRegistration(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return validationFail([
      validationError(
        PARTICIPANT_ERROR_CODE.INVALID_TYPE,
        "",
        "CompetitionRegistration must be an object"
      ),
    ]);
  }
  if (input.schemaVersion != null && !isSchemaVersionV1(input.schemaVersion)) {
    errors.push(
      validationError(
        PARTICIPANT_ERROR_CODE.INVALID_SCHEMA_VERSION,
        "schemaVersion",
        "Unsupported schemaVersion"
      )
    );
  }
  requireNonEmptyString(input.id, "id", errors);
  requireNonEmptyString(input.competitionId, "competitionId", errors);
  requireEnum(
    input.status,
    "status",
    isCompetitionRegistrationStatus,
    errors,
    PARTICIPANT_ERROR_CODE.INVALID_STATUS,
    "Invalid CompetitionRegistration.status"
  );

  // OD-10: waitlisted registration must not imply an active entry.
  if (input.status === COMPETITION_REGISTRATION_STATUS.WAITLISTED) {
    if (input.entryId && isNonEmptyString(input.entryId)) {
      errors.push(
        validationError(
          PARTICIPANT_ERROR_CODE.WAITLIST_NOT_ACTIVE_ENTRY,
          "entryId",
          "WAITLISTED registration must not reference an active Entry (OD-10)"
        )
      );
    }
  }
  return errors.length ? validationFail(errors) : validationOk();
}

/**
 * Policy helper: waitlisted registration does not create/activate an entry.
 *
 * @param {unknown} registration
 * @param {unknown} [entry]
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function assertWaitlistDoesNotActivateEntry(registration, entry) {
  if (!registration || typeof registration !== "object") {
    return validationFail([
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "registration", "registration required"),
    ]);
  }
  if (registration.status !== COMPETITION_REGISTRATION_STATUS.WAITLISTED) {
    return validationOk();
  }
  if (
    entry &&
    typeof entry === "object" &&
    (entry.status === COMPETITION_ENTRY_STATUS.ACTIVE ||
      entry.status === COMPETITION_ENTRY_STATUS.APPROVED)
  ) {
    return validationFail([
      validationError(
        PARTICIPANT_ERROR_CODE.WAITLIST_NOT_ACTIVE_ENTRY,
        "entry.status",
        "Cannot treat waitlisted registration as an active Entry (OD-10)"
      ),
    ]);
  }
  return validationOk();
}

/**
 * @param {unknown} input
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateEligibilityDecision(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return validationFail([
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "EligibilityDecision must be an object"),
    ]);
  }
  requireNonEmptyString(input.id, "id", errors);
  requireNonEmptyString(input.subjectKind, "subjectKind", errors);
  requireNonEmptyString(input.subjectId, "subjectId", errors);
  requireNonEmptyString(input.evaluatedAt, "evaluatedAt", errors);
  requireEnum(
    input.result,
    "result",
    isEligibilityDecisionStatus,
    errors,
    PARTICIPANT_ERROR_CODE.INVALID_STATUS,
    "Invalid EligibilityDecision.result"
  );
  return errors.length ? validationFail(errors) : validationOk();
}

/**
 * @param {unknown} input
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateCompetitionTeam(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return validationFail([
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "CompetitionTeam must be an object"),
    ]);
  }
  requireNonEmptyString(input.id, "id", errors);
  requireNonEmptyString(input.competitionId, "competitionId", errors);
  requireNonEmptyString(input.name, "name", errors);
  requireEnum(
    input.status,
    "status",
    isCompetitionTeamStatus,
    errors,
    PARTICIPANT_ERROR_CODE.INVALID_STATUS,
    "Invalid CompetitionTeam.status"
  );
  return errors.length ? validationFail(errors) : validationOk();
}

/**
 * @param {unknown} input
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateRosterMember(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return validationFail([
      validationError(
        PARTICIPANT_ERROR_CODE.INVALID_TYPE,
        "",
        "CompetitionRosterMember must be an object"
      ),
    ]);
  }
  requireNonEmptyString(input.id, "id", errors);
  requireNonEmptyString(input.rosterId, "rosterId", errors);
  requireEnum(
    input.status,
    "status",
    isCompetitionRosterMemberStatus,
    errors,
    PARTICIPANT_ERROR_CODE.INVALID_STATUS,
    "Invalid roster member status"
  );
  const personResult = validateParticipantReference(input.person);
  if (!personResult.valid) {
    for (const err of personResult.errors) {
      errors.push({ ...err, path: `person.${err.path}`.replace(/\.$/, "") });
    }
  }
  return errors.length ? validationFail(errors) : validationOk();
}

/**
 * @param {unknown} input
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateCompetitionRoster(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return validationFail([
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "CompetitionRoster must be an object"),
    ]);
  }
  requireNonEmptyString(input.id, "id", errors);
  requireNonEmptyString(input.competitionId, "competitionId", errors);
  requireNonEmptyString(input.teamId, "teamId", errors);
  requireEnum(
    input.status,
    "status",
    isCompetitionRosterStatus,
    errors,
    PARTICIPANT_ERROR_CODE.INVALID_STATUS,
    "Invalid CompetitionRoster.status"
  );
  if (!Array.isArray(input.members)) {
    errors.push(
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "members", "members must be an array")
    );
  } else {
    /** @type {Set<string>} */
    const personKeys = new Set();
    input.members.forEach((member, index) => {
      const result = validateRosterMember(member);
      if (!result.valid) {
        for (const err of result.errors) {
          errors.push({ ...err, path: `members[${index}].${err.path}`.replace(/\.$/, "") });
        }
      }
      const key = member?.person
        ? `${member.person.kind}:${member.person.id}`
        : "";
      if (key) {
        if (personKeys.has(key)) {
          errors.push(
            validationError(
              PARTICIPANT_ERROR_CODE.ROSTER_DUPLICATE_MEMBER,
              `members[${index}]`,
              "Duplicate roster member person reference"
            )
          );
        }
        personKeys.add(key);
      }
    });
  }
  if (input.status === COMPETITION_ROSTER_STATUS.ROSTER_LOCKED && !isNonEmptyString(input.lockedAt)) {
    errors.push(
      validationError(
        PARTICIPANT_ERROR_CODE.REQUIRED,
        "lockedAt",
        "ROSTER_LOCKED requires lockedAt timestamp"
      )
    );
  }
  return errors.length ? validationFail(errors) : validationOk();
}

/**
 * Rejects direct member mutation of a locked roster (OD-04/OD-05).
 * Amendments must use substitution references.
 *
 * @param {unknown} original
 * @param {unknown} next
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function assertRosterNotDirectlyMutatedWhenLocked(original, next) {
  if (!original || typeof original !== "object" || !next || typeof next !== "object") {
    return validationFail([
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "original and next roster required"),
    ]);
  }
  if (original.status !== COMPETITION_ROSTER_STATUS.ROSTER_LOCKED) {
    return validationOk();
  }
  const originalKeys = JSON.stringify(
    (original.members || []).map((m) => `${m?.person?.kind}:${m?.person?.id}`)
  );
  const nextKeys = JSON.stringify(
    (next.members || []).map((m) => `${m?.person?.kind}:${m?.person?.id}`)
  );
  if (originalKeys !== nextKeys) {
    const hasAmendments = Array.isArray(next.amendments) && next.amendments.length > 0;
    if (!hasAmendments) {
      return validationFail([
        validationError(
          PARTICIPANT_ERROR_CODE.ROSTER_LOCKED_IMMUTABLE,
          "members",
          "Locked roster members cannot be mutated directly; use substitution amendment (OD-05)"
        ),
      ]);
    }
  }
  return validationOk();
}

/**
 * @param {unknown} input
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateLineupRevision(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return validationFail([
      validationError(
        PARTICIPANT_ERROR_CODE.INVALID_TYPE,
        "",
        "CompetitionLineupRevision must be an object"
      ),
    ]);
  }
  requireNonEmptyString(input.lineupId, "lineupId", errors);
  if (typeof input.revision !== "number" || !Number.isInteger(input.revision) || input.revision < 1) {
    errors.push(
      validationError(
        PARTICIPANT_ERROR_CODE.LINEUP_REVISION_INVALID,
        "revision",
        "revision must be an integer >= 1"
      )
    );
  }
  requireEnum(
    input.status,
    "status",
    isCompetitionLineupStatus,
    errors,
    PARTICIPANT_ERROR_CODE.INVALID_STATUS,
    "Invalid lineup revision status"
  );
  if (!Array.isArray(input.slots)) {
    errors.push(
      validationError(PARTICIPANT_ERROR_CODE.LINEUP_SLOT_INVALID, "slots", "slots must be an array")
    );
  } else {
    input.slots.forEach((slot, index) => {
      if (!slot || typeof slot !== "object") {
        errors.push(
          validationError(
            PARTICIPANT_ERROR_CODE.LINEUP_SLOT_INVALID,
            `slots[${index}]`,
            "slot must be an object"
          )
        );
        return;
      }
      requireNonEmptyString(slot.id, `slots[${index}].id`, errors);
      requireNonEmptyString(slot.disciplineOrSideKey, `slots[${index}].disciplineOrSideKey`, errors);
      if (typeof slot.index !== "number") {
        errors.push(
          validationError(
            PARTICIPANT_ERROR_CODE.LINEUP_SLOT_INVALID,
            `slots[${index}].index`,
            "slot.index must be a number"
          )
        );
      }
      const personResult = validateParticipantReference(slot.person);
      if (!personResult.valid) {
        for (const err of personResult.errors) {
          errors.push({
            ...err,
            path: `slots[${index}].person.${err.path}`.replace(/\.$/, ""),
          });
        }
      }
    });
  }
  if (input.revision === 1 && input.previousRevisionId != null && input.previousRevisionId !== "") {
    errors.push(
      validationError(
        PARTICIPANT_ERROR_CODE.LINEUP_PREVIOUS_REVISION,
        "previousRevisionId",
        "First revision must not set previousRevisionId"
      )
    );
  }
  if (input.revision > 1 && !isNonEmptyString(input.previousRevisionId)) {
    errors.push(
      validationError(
        PARTICIPANT_ERROR_CODE.LINEUP_PREVIOUS_REVISION,
        "previousRevisionId",
        "Revisions after 1 require previousRevisionId"
      )
    );
  }
  return errors.length ? validationFail(errors) : validationOk();
}

/**
 * @param {unknown} input
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateCompetitionLineup(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return validationFail([
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "CompetitionLineup must be an object"),
    ]);
  }
  requireNonEmptyString(input.id, "id", errors);
  requireNonEmptyString(input.competitionId, "competitionId", errors);
  requireNonEmptyString(input.teamId, "teamId", errors);
  requireNonEmptyString(input.contextId, "contextId", errors);
  requireEnum(
    input.status,
    "status",
    isCompetitionLineupStatus,
    errors,
    PARTICIPANT_ERROR_CODE.INVALID_STATUS,
    "Invalid CompetitionLineup.status"
  );
  const asRevision = {
    lineupId: input.id,
    revision: input.revision,
    previousRevisionId: input.previousRevisionId,
    submittedAt: input.submittedAt,
    submittedBy: input.submittedBy,
    lockedAt: input.lockedAt,
    status: input.status,
    slots: input.slots,
    reason: input.reason,
  };
  const revisionResult = validateLineupRevision(asRevision);
  if (!revisionResult.valid) {
    errors.push(...revisionResult.errors);
  }
  if (Array.isArray(input.revisions) && input.revisions.length > 0) {
    const seq = validateLineupRevisionSequence(input.revisions);
    if (!seq.valid) errors.push(...seq.errors);
  }
  return errors.length ? validationFail(errors) : validationOk();
}

/**
 * Ensures revision numbers increase by 1 without duplicates/decreases (OD-06).
 *
 * @param {unknown[]} revisions
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateLineupRevisionSequence(revisions) {
  if (!Array.isArray(revisions) || revisions.length === 0) {
    return validationFail([
      validationError(
        PARTICIPANT_ERROR_CODE.LINEUP_REVISION_INVALID,
        "revisions",
        "revisions must be a non-empty array"
      ),
    ]);
  }
  const errors = [];
  const sorted = [...revisions].sort(
    (a, b) => (Number(a?.revision) || 0) - (Number(b?.revision) || 0)
  );
  /** @type {Set<number>} */
  const seen = new Set();
  for (let i = 0; i < sorted.length; i += 1) {
    const rev = sorted[i];
    const n = Number(rev?.revision);
    if (!Number.isInteger(n) || n < 1) {
      errors.push(
        validationError(
          PARTICIPANT_ERROR_CODE.LINEUP_REVISION_INVALID,
          `revisions[${i}].revision`,
          "revision must be integer >= 1"
        )
      );
      continue;
    }
    if (seen.has(n)) {
      errors.push(
        validationError(
          PARTICIPANT_ERROR_CODE.LINEUP_REVISION_SEQUENCE,
          `revisions[${i}].revision`,
          "Duplicate lineup revision number"
        )
      );
    }
    seen.add(n);
    if (i === 0 && n !== 1) {
      errors.push(
        validationError(
          PARTICIPANT_ERROR_CODE.LINEUP_REVISION_SEQUENCE,
          `revisions[${i}].revision`,
          "Revision sequence must start at 1"
        )
      );
    }
    if (i > 0) {
      const prev = Number(sorted[i - 1]?.revision);
      if (n !== prev + 1) {
        errors.push(
          validationError(
            PARTICIPANT_ERROR_CODE.LINEUP_REVISION_SEQUENCE,
            `revisions[${i}].revision`,
            "Lineup revisions must increase by 1 without gaps or decreases"
          )
        );
      }
      if (!isNonEmptyString(rev?.previousRevisionId)) {
        errors.push(
          validationError(
            PARTICIPANT_ERROR_CODE.LINEUP_PREVIOUS_REVISION,
            `revisions[${i}].previousRevisionId`,
            "previousRevisionId is required for revisions after 1"
          )
        );
      }
    }
  }
  return errors.length ? validationFail(errors) : validationOk();
}

/**
 * Locked/published revisions are immutable; changes require a new revision.
 *
 * @param {unknown} original
 * @param {unknown} next
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function assertLineupRevisionImmutableWhenLocked(original, next) {
  if (!original || typeof original !== "object" || !next || typeof next !== "object") {
    return validationFail([
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "original and next revision required"),
    ]);
  }
  const lockedStatuses = [
    COMPETITION_LINEUP_STATUS.LOCKED,
    COMPETITION_LINEUP_STATUS.PUBLISHED,
  ];
  if (!lockedStatuses.includes(original.status)) {
    return validationOk();
  }
  if (original.revision === next.revision) {
    const a = JSON.stringify(original.slots || []);
    const b = JSON.stringify(next.slots || []);
    if (a !== b || original.status !== next.status) {
      return validationFail([
        validationError(
          PARTICIPANT_ERROR_CODE.LINEUP_LOCKED_IMMUTABLE,
          "slots",
          "Locked lineup revision is immutable; create a new revision instead (OD-06)"
        ),
      ]);
    }
  }
  return validationOk();
}

/**
 * @param {unknown} input
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateDivision(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return validationFail([
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "CompetitionDivision must be an object"),
    ]);
  }
  requireNonEmptyString(input.id, "id", errors);
  requireNonEmptyString(input.competitionId, "competitionId", errors);
  requireNonEmptyString(input.name, "name", errors);
  if ("code" in input && !("name" in input && input.name)) {
    // defensive: division must not be modeled as category-like code-only
  }
  return errors.length ? validationFail(errors) : validationOk();
}

/**
 * @param {unknown} input
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateCategory(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return validationFail([
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "CompetitionCategory must be an object"),
    ]);
  }
  requireNonEmptyString(input.id, "id", errors);
  requireNonEmptyString(input.competitionId, "competitionId", errors);
  requireNonEmptyString(input.code, "code", errors);
  return errors.length ? validationFail(errors) : validationOk();
}

/**
 * Ensures Division and Category remain separate entity shapes (OD-07).
 *
 * @param {unknown} division
 * @param {unknown} category
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function assertDivisionAndCategoryAreSeparate(division, category) {
  if (!division || !category) {
    return validationOk();
  }
  if (division === category) {
    return validationFail([
      validationError(
        PARTICIPANT_ERROR_CODE.DIVISION_CATEGORY_COLLISION,
        "",
        "Division and Category must be separate entities (OD-07)"
      ),
    ]);
  }
  // Reject overloaded single-field classification masquerading as both.
  if (
    division &&
    category &&
    typeof division === "object" &&
    typeof category === "object" &&
    division.kind === "classification" &&
    category.kind === "classification"
  ) {
    return validationFail([
      validationError(
        PARTICIPANT_ERROR_CODE.DIVISION_CATEGORY_COLLISION,
        "kind",
        "Do not overload a shared classification kind for Division and Category (OD-07)"
      ),
    ]);
  }
  return validationOk();
}

/**
 * @param {unknown} input
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateParticipantSnapshot(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return validationFail([
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "ParticipantSnapshot must be an object"),
    ]);
  }
  if (!isJsonSafe(input)) {
    errors.push(
      validationError(
        PARTICIPANT_ERROR_CODE.SNAPSHOT_NOT_JSON_SAFE,
        "",
        "ParticipantSnapshot must be JSON-safe"
      )
    );
  }
  if (input.identityReference) {
    const refResult = validateParticipantReference(input.identityReference);
    if (!refResult.valid) {
      for (const err of refResult.errors) {
        errors.push({ ...err, path: `identityReference.${err.path}`.replace(/\.$/, "") });
      }
    }
  }
  requireNonEmptyString(input.snapshotAt, "snapshotAt", errors);
  return errors.length ? validationFail(errors) : validationOk();
}

export { createParticipantValidationResult };
