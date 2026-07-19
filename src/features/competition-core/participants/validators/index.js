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
  isCompetitionEntryType,
  ACTIVE_ENTRY_STATUSES,
  isActiveCompetitionEntryStatus,
  isTerminalCompetitionEntryStatus,
  COMPETITION_REGISTRATION_STATUS,
  COMPETITION_ROSTER_STATUS,
  COMPETITION_LINEUP_STATUS,
  COMPETITION_ENTRY_STATUS,
  COMPETITION_ENTRY_TYPE,
} from "../enums/index.js";
import {
  isNonEmptyString,
  isSchemaVersionV1,
  isJsonSafe,
} from "../contracts/shared.js";
import {
  buildEntryIdentityKey,
  buildStableEntrySourceIdentity,
  memberReferenceToken,
} from "../contracts/entryIdentity.js";
import { isValidCompetitionTeamReference } from "../contracts/teamReference.js";
import {
  compareEntryTenantScopes,
  createEntryTenantScope,
} from "../contracts/tenantScope.js";
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
 * @param {{
 *   requireDivisionId?: boolean,
 *   requireCategoryId?: boolean,
 *   requireEntryRole?: boolean,
 *   requireEntryType?: boolean,
 *   expectedCompetitionId?: string|null,
 *   expectedTenantScope?: import('../contracts/tenantScope.js').EntryTenantScope|null,
 *   requireTenantScope?: boolean,
 * }} [context]
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

  const entryType =
    input.entryType != null && String(input.entryType).trim() !== ""
      ? String(input.entryType).trim()
      : null;

  if (context.requireEntryType === true && !entryType) {
    errors.push(
      validationError(
        PARTICIPANT_ERROR_CODE.INVALID_ENTRY_TYPE,
        "entryType",
        "CompetitionEntry.entryType is required by policy context"
      )
    );
  }

  if (entryType != null) {
    if (!isCompetitionEntryType(entryType)) {
      errors.push(
        validationError(
          PARTICIPANT_ERROR_CODE.INVALID_ENTRY_TYPE,
          "entryType",
          "CompetitionEntry.entryType must be COMPETITION_ENTRY_TYPE",
          { value: entryType }
        )
      );
    } else {
      const structure = validateCompetitionEntryTypeStructure(input);
      if (!structure.valid) {
        errors.push(...structure.errors);
      }
    }
  } else if (!Array.isArray(input.memberRefs) || input.memberRefs.length < 1) {
    // Legacy path (pre–Core-02): entries without entryType still require ≥1 memberRef.
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

  if (input.representativeRef != null) {
    const rep = validateParticipantReference(input.representativeRef);
    if (!rep.valid) {
      errors.push(
        validationError(
          PARTICIPANT_ERROR_CODE.INVALID_REPRESENTATIVE_REF,
          "representativeRef",
          "representativeRef must be a valid ParticipantReference"
        )
      );
      for (const err of rep.errors) {
        errors.push({
          ...err,
          path: `representativeRef.${err.path}`.replace(/\.$/, ""),
        });
      }
    }
  }

  if (isNonEmptyString(context.expectedCompetitionId)) {
    if (
      isNonEmptyString(input.competitionId) &&
      String(input.competitionId).trim() !== String(context.expectedCompetitionId).trim()
    ) {
      errors.push(
        validationError(
          PARTICIPANT_ERROR_CODE.COMPETITION_SCOPE_CONFLICT,
          "competitionId",
          "Entry competitionId conflicts with expected competition scope",
          {
            expected: context.expectedCompetitionId,
            actual: input.competitionId,
          }
        )
      );
    }
  }

  const tenantCheck = validateEntryTenantIsolation(input, {
    expectedTenantScope: context.expectedTenantScope,
    requireTenantScope: context.requireTenantScope === true,
  });
  if (!tenantCheck.valid) {
    errors.push(...tenantCheck.errors);
  }

  if (entryType && isCompetitionEntryType(entryType) && isNonEmptyString(input.competitionId)) {
    const identityCheck = validateCompetitionEntryIdentityConsistency(input);
    if (!identityCheck.valid) {
      errors.push(...identityCheck.errors);
    }
  }

  // Metadata / extensions must not be treated as authority for type/tenant/eligibility.
  assertMetadataIsNotAuthority(input, errors);

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
 * Structural invariants for COMPETITION_ENTRY_TYPE (Core-02).
 * @param {unknown} input
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateCompetitionEntryTypeStructure(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return validationFail([
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "CompetitionEntry must be an object"),
    ]);
  }

  const entryType = String(input.entryType || "").trim();
  if (!isCompetitionEntryType(entryType)) {
    return validationFail([
      validationError(
        PARTICIPANT_ERROR_CODE.INVALID_ENTRY_TYPE,
        "entryType",
        "Invalid COMPETITION_ENTRY_TYPE"
      ),
    ]);
  }

  const memberRefs = Array.isArray(input.memberRefs) ? input.memberRefs : [];
  const teamRef = input.teamRef;

  for (let index = 0; index < memberRefs.length; index += 1) {
    const result = validateParticipantReference(memberRefs[index]);
    if (!result.valid) {
      for (const err of result.errors) {
        errors.push({ ...err, path: `memberRefs[${index}].${err.path}`.replace(/\.$/, "") });
      }
    }
  }

  if (entryType === COMPETITION_ENTRY_TYPE.INDIVIDUAL) {
    if (teamRef != null && isValidCompetitionTeamReference(teamRef)) {
      errors.push(
        validationError(
          PARTICIPANT_ERROR_CODE.ENTRY_TYPE_STRUCTURE_CONFLICT,
          "teamRef",
          "INDIVIDUAL entry cannot carry a teamRef"
        )
      );
    }
    if (memberRefs.length !== 1) {
      errors.push(
        validationError(
          PARTICIPANT_ERROR_CODE.ENTRY_TYPE_MEMBERSHIP,
          "memberRefs",
          "INDIVIDUAL entry requires exactly one memberRef",
          { count: memberRefs.length }
        )
      );
    }
  } else if (entryType === COMPETITION_ENTRY_TYPE.PAIR) {
    if (teamRef != null && isValidCompetitionTeamReference(teamRef)) {
      errors.push(
        validationError(
          PARTICIPANT_ERROR_CODE.ENTRY_TYPE_STRUCTURE_CONFLICT,
          "teamRef",
          "PAIR entry cannot carry a teamRef"
        )
      );
    }
    if (memberRefs.length !== 2) {
      errors.push(
        validationError(
          PARTICIPANT_ERROR_CODE.ENTRY_TYPE_MEMBERSHIP,
          "memberRefs",
          "PAIR entry requires exactly two memberRefs",
          { count: memberRefs.length }
        )
      );
    } else {
      const a = memberReferenceToken(memberRefs[0]);
      const b = memberReferenceToken(memberRefs[1]);
      if (!a || !b) {
        errors.push(
          validationError(
            PARTICIPANT_ERROR_CODE.ENTRY_TYPE_MEMBERSHIP,
            "memberRefs",
            "PAIR members must be valid ParticipantReferences"
          )
        );
      } else if (a === b) {
        errors.push(
          validationError(
            PARTICIPANT_ERROR_CODE.ENTRY_TYPE_MEMBERSHIP,
            "memberRefs",
            "PAIR members must be distinct"
          )
        );
      }
    }
  } else if (entryType === COMPETITION_ENTRY_TYPE.TEAM) {
    if (!isValidCompetitionTeamReference(teamRef)) {
      errors.push(
        validationError(
          PARTICIPANT_ERROR_CODE.INVALID_TEAM_REF,
          "teamRef",
          "TEAM entry requires a valid teamRef"
        )
      );
    }
    // Optional bridge: memberRefs may be empty. Conflicting INDIVIDUAL/PAIR-only
    // structure without teamRef is already rejected above. Reject TEAM that also
    // claims pair/individual competing-unit shape via missing teamRef only.
    if (
      !isValidCompetitionTeamReference(teamRef) &&
      (memberRefs.length === 1 || memberRefs.length === 2)
    ) {
      errors.push(
        validationError(
          PARTICIPANT_ERROR_CODE.ENTRY_TYPE_STRUCTURE_CONFLICT,
          "entryType",
          "TEAM entry cannot use individual/pair membership as a substitute for teamRef"
        )
      );
    }
    if (teamRef && isNonEmptyString(teamRef.competitionId) && isNonEmptyString(input.competitionId)) {
      if (String(teamRef.competitionId).trim() !== String(input.competitionId).trim()) {
        errors.push(
          validationError(
            PARTICIPANT_ERROR_CODE.COMPETITION_SCOPE_CONFLICT,
            "teamRef.competitionId",
            "teamRef.competitionId conflicts with entry.competitionId"
          )
        );
      }
    }
  }

  return errors.length ? validationFail(errors) : validationOk();
}

/**
 * @param {unknown} input
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateCompetitionEntryIdentityConsistency(input) {
  if (!input || typeof input !== "object") {
    return validationFail([
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "CompetitionEntry must be an object"),
    ]);
  }
  if (!isCompetitionEntryType(input.entryType) || !isNonEmptyString(input.competitionId)) {
    return validationOk();
  }

  const expectedStable = buildStableEntrySourceIdentity({
    entryType: input.entryType,
    memberRefs: input.memberRefs,
    teamRef: input.teamRef,
  });
  if (!isNonEmptyString(expectedStable)) {
    return validationFail([
      validationError(
        PARTICIPANT_ERROR_CODE.ENTRY_IDENTITY_INVALID,
        "identityKey",
        "Cannot derive stableSourceIdentity for entry"
      ),
    ]);
  }

  const expectedKey = buildEntryIdentityKey({
    competitionId: input.competitionId,
    entryType: input.entryType,
    stableSourceIdentity: expectedStable,
    memberRefs: input.memberRefs,
    teamRef: input.teamRef,
  });

  if (isNonEmptyString(input.identityKey) && String(input.identityKey).trim() !== expectedKey) {
    return validationFail([
      validationError(
        PARTICIPANT_ERROR_CODE.ENTRY_IDENTITY_MISMATCH,
        "identityKey",
        "identityKey does not match deterministic construction",
        { expected: expectedKey, actual: input.identityKey }
      ),
    ]);
  }

  return validationOk();
}

/**
 * @param {unknown} input
 * @param {{
 *   expectedTenantScope?: import('../contracts/tenantScope.js').EntryTenantScope|null,
 *   requireTenantScope?: boolean,
 * }} [context]
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateEntryTenantIsolation(input, context = {}) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return validationFail([
      validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "CompetitionEntry must be an object"),
    ]);
  }

  const entryScope = createEntryTenantScope(input.tenantScope);
  const expected = createEntryTenantScope(context.expectedTenantScope);

  if (context.requireTenantScope === true && !entryScope) {
    errors.push(
      validationError(
        PARTICIPANT_ERROR_CODE.TENANT_SCOPE_MISSING,
        "tenantScope",
        "tenantScope is required; missing scope must not fall back to a default tenant"
      )
    );
  }

  if (entryScope && expected) {
    const cmp = compareEntryTenantScopes(entryScope, expected);
    if (cmp.conflict) {
      errors.push(
        validationError(
          PARTICIPANT_ERROR_CODE.TENANT_SCOPE_CONFLICT,
          `tenantScope.${cmp.field}`,
          "Cross-tenant entry reference rejected",
          cmp
        )
      );
    }
  }

  return errors.length ? validationFail(errors) : validationOk();
}

/**
 * @param {unknown} input
 * @param {import('../results/validationResult.js').ParticipantValidationIssue[]} errors
 */
function assertMetadataIsNotAuthority(input, errors) {
  if (!input || typeof input !== "object") return;
  const meta = input.metadata;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return;

  const forbiddenAuthorityKeys = [
    "entryType",
    "tenantId",
    "clubId",
    "organizationId",
    "eligible",
    "eligibility",
    "authorized",
    "authorization",
    "identityKey",
  ];
  for (const key of forbiddenAuthorityKeys) {
    if (Object.prototype.hasOwnProperty.call(meta, key) && meta[key] != null) {
      // Soft structural signal: metadata may *carry* copies for diagnostics, but
      // must not be the sole controller — emit typed code when metadata claims
      // authority fields while canonical fields disagree or are missing.
      const canonical =
        key === "entryType"
          ? input.entryType
          : key === "identityKey"
            ? input.identityKey
            : input.tenantScope?.[key === "tenantId" || key === "clubId" || key === "organizationId" ? key : ""];

      if (
        (key === "entryType" || key === "identityKey") &&
        meta[key] != null &&
        (canonical == null || String(canonical) === "") &&
        String(meta[key]) !== ""
      ) {
        errors.push(
          validationError(
            PARTICIPANT_ERROR_CODE.METADATA_NOT_AUTHORITY,
            `metadata.${key}`,
            "Metadata cannot control entry type, tenant ownership, eligibility or identity"
          )
        );
      }
      if (
        (key === "tenantId" || key === "clubId" || key === "organizationId") &&
        meta[key] != null &&
        (!input.tenantScope || input.tenantScope[key] == null || input.tenantScope[key] === "")
      ) {
        errors.push(
          validationError(
            PARTICIPANT_ERROR_CODE.METADATA_NOT_AUTHORITY,
            `metadata.${key}`,
            "Metadata cannot control tenant ownership"
          )
        );
      }
      if (
        (key === "eligible" ||
          key === "eligibility" ||
          key === "authorized" ||
          key === "authorization") &&
        meta[key] != null
      ) {
        errors.push(
          validationError(
            PARTICIPANT_ERROR_CODE.METADATA_NOT_AUTHORITY,
            `metadata.${key}`,
            "Metadata cannot control authorization or eligibility"
          )
        );
      }
    }
  }
}

/**
 * OD-02 + Core-02: detect duplicate active entries by identityKey when present.
 * Terminal statuses are ignored. Pure lookup — no Production persistence.
 *
 * @param {unknown[]} entries
 * @param {{ allowDuplicateIdentity?: boolean }} [policy]
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function detectDuplicateActiveEntryIdentities(entries, policy = {}) {
  if (policy.allowDuplicateIdentity === true) {
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
    if (!isActiveCompetitionEntryStatus(entry.status)) continue;
    if (isTerminalCompetitionEntryStatus(entry.status)) continue;
    const key = isNonEmptyString(entry.identityKey)
      ? String(entry.identityKey).trim()
      : null;
    if (!key) continue;
    if (seen.has(key)) {
      errors.push(
        validationError(
          PARTICIPANT_ERROR_CODE.DUPLICATE_ACTIVE_ENTRY_IDENTITY,
          "identityKey",
          "Duplicate active entry identityKey",
          {
            identityKey: key,
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
 * In-memory active-entry identity registry for tests / shadow callers.
 * @returns {{
 *   list: () => unknown[],
 *   register: (entry: unknown) => import('../results/validationResult.js').ParticipantValidationResult,
 *   detectDuplicates: () => import('../results/validationResult.js').ParticipantValidationResult,
 * }}
 */
export function createInMemoryActiveEntryIdentityRegistry() {
  /** @type {unknown[]} */
  const store = [];
  return {
    list() {
      return [...store];
    },
    register(entry) {
      const next = [...store, entry];
      const result = detectDuplicateActiveEntryIdentities(next);
      if (!result.valid) {
        return result;
      }
      store.push(entry);
      return validationOk();
    },
    detectDuplicates() {
      return detectDuplicateActiveEntryIdentities(store);
    },
  };
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
