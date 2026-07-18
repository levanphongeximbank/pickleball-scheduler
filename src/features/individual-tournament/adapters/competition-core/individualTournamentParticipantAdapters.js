/**
 * Individual Tournament → Competition Core adapters (Phase 2B.3).
 * Shadow/mapping only — not wired to Production executors.
 */

import {
  PARTICIPANT_SCHEMA_VERSION,
  PARTICIPANT_REFERENCE_KIND,
  COMPETITION_PARTICIPANT_STATUS,
  COMPETITION_ENTRY_STATUS,
  COMPETITION_REGISTRATION_STATUS,
  createCompetitionParticipant,
  createCompetitionEntry,
  createCompetitionRegistration,
  createCompetitionDivision,
  createCompetitionCategory,
  createSeedLockedRatingSnapshot,
  createFormatExtension,
  validateCompetitionParticipant,
  validateCompetitionEntry,
  validateCompetitionRegistration,
  validateDivision,
  validateCategory,
  assertWaitlistDoesNotActivateEntry,
  detectDuplicateActiveEntryScopes,
} from "../../../competition-core/index.js";

import {
  MAPPING_DIAGNOSTIC_CODE,
  MAPPING_DIAGNOSTIC_SEVERITY,
  createMappingDiagnostic,
  finalizeMappingResult,
  cloneSourceSnapshot,
  resolvePersonReference,
  buildPlayerSnapshot,
  PARITY_CLASSIFICATION,
  createParityFinding,
  compareIdentityParity,
} from "../../../../tournament/adapters/competition-core/shared/index.js";

const SOURCE_VERSION = "individual-tournament-v1";
const FORMAT_KEY = "individual-tournament";

/**
 * @param {unknown} source
 * @returns {Record<string, unknown>|null}
 */
function asObject(source) {
  return source && typeof source === "object" && !Array.isArray(source) ? source : null;
}

/**
 * @param {string} status
 */
export function mapLegacyEntryStatusToEntry(status) {
  const raw = String(status || "draft").toLowerCase();
  switch (raw) {
    case "pending":
      return COMPETITION_ENTRY_STATUS.PENDING;
    case "approved":
      return COMPETITION_ENTRY_STATUS.APPROVED;
    case "active":
      return COMPETITION_ENTRY_STATUS.ACTIVE;
    case "withdrawn":
      return COMPETITION_ENTRY_STATUS.WITHDRAWN;
    case "cancelled":
    case "rejected":
    case "waitlisted":
      // Waitlisted/rejected must not become active Entry (OD-10)
      return COMPETITION_ENTRY_STATUS.DRAFT;
    case "draft":
    default:
      return COMPETITION_ENTRY_STATUS.DRAFT;
  }
}

/**
 * @param {string} status
 */
export function mapLegacyEntryStatusToRegistration(status) {
  const raw = String(status || "draft").toLowerCase();
  switch (raw) {
    case "pending":
      return COMPETITION_REGISTRATION_STATUS.PENDING;
    case "approved":
    case "active":
      return COMPETITION_REGISTRATION_STATUS.APPROVED;
    case "waitlisted":
      return COMPETITION_REGISTRATION_STATUS.WAITLISTED;
    case "rejected":
      return COMPETITION_REGISTRATION_STATUS.REJECTED;
    case "cancelled":
      return COMPETITION_REGISTRATION_STATUS.CANCELLED;
    case "withdrawn":
      return COMPETITION_REGISTRATION_STATUS.WITHDRAWN;
    case "draft":
    default:
      return COMPETITION_REGISTRATION_STATUS.DRAFT;
  }
}

/**
 * Player → CompetitionParticipant
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 */
export function mapIndividualPlayerToParticipant(source, context = {}) {
  const before = cloneSourceSnapshot(source);
  const player = asObject(source);
  const diagnostics = [];
  const competitionId = String(
    context.competitionId || context.tournamentId || player?.tournamentId || player?.competitionId || ""
  ).trim();

  if (!player?.id) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_SOURCE_ID,
        path: "id",
        message: "Player id required",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "IndividualPlayer",
      })
    );
    return finalizeMappingResult({
      success: false,
      diagnostics,
      sourceType: "IndividualPlayer",
      sourceVersion: SOURCE_VERSION,
    });
  }

  if (!competitionId) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID,
        path: "competitionId",
        message: "competitionId required",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "IndividualPlayer",
        sourceId: String(player.id),
      })
    );
  }

  const person = resolvePersonReference(player);
  const value = createCompetitionParticipant({
    id: `cp:ind:${player.id}`,
    competitionId,
    person,
    status: COMPETITION_PARTICIPANT_STATUS.ACTIVE,
    displayName: player.name || player.displayName || null,
    snapshot: buildPlayerSnapshot(player, {
      snapshotAt: context.snapshotAt || player.registeredAt || null,
      seedLocked: context.seedLocked === true,
      clubId: context.clubId,
    }),
    extensions: createFormatExtension({
      formatKey: FORMAT_KEY,
      payload: {
        playerType: player.playerType || null,
        guest: person.kind === PARTICIPANT_REFERENCE_KIND.GUEST,
        external: person.kind === PARTICIPANT_REFERENCE_KIND.EXTERNAL,
      },
    }),
  });

  const validation = validateCompetitionParticipant(value);
  if (!validation.valid) {
    for (const err of validation.errors) {
      diagnostics.push(
        createMappingDiagnostic({
          code:
            err.path === "competitionId"
              ? MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID
              : MAPPING_DIAGNOSTIC_CODE.INVALID_IDENTITY_REFERENCE,
          path: err.path,
          message: err.message,
          severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
          sourceType: "IndividualPlayer",
          sourceId: String(player.id),
          metadata: { participantErrorCode: err.code },
        })
      );
    }
  }

  void before;
  return finalizeMappingResult({
    success: diagnostics.every((d) => d.severity !== MAPPING_DIAGNOSTIC_SEVERITY.ERROR),
    value,
    diagnostics,
    sourceType: "IndividualPlayer",
    sourceId: String(player.id),
    sourceVersion: SOURCE_VERSION,
    targetSchemaVersion: PARTICIPANT_SCHEMA_VERSION,
  });
}

/**
 * Legacy entry → CompetitionRegistration (+ CompetitionEntry when not waitlisted).
 * OD-02: does not merge multiple entries.
 * OD-10: waitlist does not create active Entry.
 *
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 */
export function mapIndividualEntry(source, context = {}) {
  const before = cloneSourceSnapshot(source);
  const entry = asObject(source);
  const diagnostics = [];

  if (!entry?.id) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_SOURCE_ID,
        path: "id",
        message: "Entry id required",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "IndividualEntry",
      })
    );
    return finalizeMappingResult({
      success: false,
      diagnostics,
      sourceType: "IndividualEntry",
      sourceVersion: SOURCE_VERSION,
    });
  }

  const competitionId = String(
    context.competitionId || context.tournamentId || entry.tournamentId || entry.competitionId || ""
  ).trim();

  if (!competitionId) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID,
        path: "competitionId",
        message: "Entry mapping requires competitionId/tournamentId (OD-03)",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "IndividualEntry",
        sourceId: String(entry.id),
      })
    );
  }

  const rawStatus = String(entry.status || "draft").toLowerCase();
  const isWaitlisted = rawStatus === "waitlisted";
  const playerIds = Array.isArray(entry.playerIds)
    ? entry.playerIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const playerById = context.playerById || {};

  const memberRefs = playerIds.map((id) => {
    const player = playerById[id] || { id };
    return resolvePersonReference(player, id);
  });

  if (playerIds.length === 0 && rawStatus !== "draft") {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.UNRESOLVED_PLAYER_REFERENCE,
        path: "playerIds",
        message: "Entry has no player ids",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.WARNING,
        sourceType: "IndividualEntry",
        sourceId: String(entry.id),
      })
    );
  }

  // Partner invite: partial doubles — keep token in extensions (Format-owned)
  const hasPartnerInvite = Boolean(entry.partnerInviteToken);

  const divisionId = entry.groupId || entry.divisionId || null;
  const categoryId = entry.eventId || entry.categoryId || null;

  if (context.requireDivision === true && !divisionId) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_DIVISION_REFERENCE,
        path: "divisionId",
        message: "Division/group reference missing",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "IndividualEntry",
        sourceId: String(entry.id),
      })
    );
  }

  if (context.requireCategory === true && !categoryId) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_CATEGORY_REFERENCE,
        path: "categoryId",
        message: "Category/event reference missing",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "IndividualEntry",
        sourceId: String(entry.id),
      })
    );
  }

  const registration = createCompetitionRegistration({
    id: `reg:ind:${entry.id}`,
    competitionId,
    status: mapLegacyEntryStatusToRegistration(rawStatus),
    entryId: isWaitlisted ? null : String(entry.id),
    waitlistPosition: isWaitlisted
      ? typeof entry.waitlistPosition === "number"
        ? entry.waitlistPosition
        : null
      : null,
    submittedAt: entry.registeredAt || null,
    decidedAt: entry.decidedAt || null,
    decidedBy: entry.decidedBy || null,
    rejectionReason: entry.rejectionReason || null,
    extensions: createFormatExtension({
      formatKey: FORMAT_KEY,
      payload: {
        sourceEntryId: String(entry.id),
        partnerInviteToken: entry.partnerInviteToken || null,
        hasPartnerInvite,
        pairType: entry.pairType || null,
        sourceStatus: rawStatus,
      },
    }),
    audit: {
      createdAt: entry.registeredAt || null,
      decidedAt: entry.decidedAt || null,
      decidedBy: entry.decidedBy || null,
    },
  });

  /** @type {ReturnType<typeof createCompetitionEntry>|null} */
  let competitionEntry = null;
  if (!isWaitlisted) {
    const entryRole =
      playerIds.length >= 2 || entry.pairType
        ? "doubles"
        : playerIds.length === 1
          ? "singles"
          : entry.entryRole || null;

    competitionEntry = createCompetitionEntry({
      id: String(entry.id),
      competitionId,
      status: mapLegacyEntryStatusToEntry(rawStatus),
      memberRefs,
      divisionId: divisionId ? String(divisionId) : null,
      categoryId: categoryId ? String(categoryId) : null,
      entryRole,
      name: entry.name || null,
      seed: typeof entry.seed === "number" ? entry.seed : null,
      ratingSnapshot: buildPlayerSnapshot(
        {
          id: playerIds[0] || entry.id,
          name: entry.name,
          rating: entry.rating,
          clubName: entry.clubName || entry.representativeClubName,
          unitName: entry.unitName,
        },
        {
          snapshotAt: entry.registeredAt || null,
          seedLocked: context.seedLocked === true,
        }
      ),
      groupId: entry.groupId ? String(entry.groupId) : null,
      extensions: createFormatExtension({
        formatKey: FORMAT_KEY,
        payload: {
          pairType: entry.pairType || null,
          partnerInviteToken: entry.partnerInviteToken || null,
          representativeClubName: entry.representativeClubName || null,
          clubName: entry.clubName || null,
          unitName: entry.unitName || null,
          // OD-07: keep division and category as separate fields — never merge
          divisionSource: "groupId",
          categorySource: "eventId",
        },
      }),
      audit: {
        createdAt: entry.registeredAt || null,
        decidedAt: entry.decidedAt || null,
        decidedBy: entry.decidedBy || null,
      },
    });
  }

  const regValidation = validateCompetitionRegistration(registration);
  if (!regValidation.valid) {
    for (const err of regValidation.errors) {
      diagnostics.push(
        createMappingDiagnostic({
          code: MAPPING_DIAGNOSTIC_CODE.UNSUPPORTED_FORMAT_POLICY,
          path: err.path,
          message: err.message,
          severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
          sourceType: "IndividualEntry",
          sourceId: String(entry.id),
          metadata: { participantErrorCode: err.code },
        })
      );
    }
  }

  if (competitionEntry) {
    const entryValidation = validateCompetitionEntry(competitionEntry);
    if (!entryValidation.valid) {
      for (const err of entryValidation.errors) {
        diagnostics.push(
          createMappingDiagnostic({
            code:
              err.path === "competitionId"
                ? MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID
                : MAPPING_DIAGNOSTIC_CODE.INVALID_IDENTITY_REFERENCE,
            path: err.path,
            message: err.message,
            severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
            sourceType: "IndividualEntry",
            sourceId: String(entry.id),
            metadata: { participantErrorCode: err.code },
          })
        );
      }
    }

    // OD-10 guard even for non-waitlist path misuse
    const waitlistGuard = assertWaitlistDoesNotActivateEntry(registration, competitionEntry);
    if (!waitlistGuard.valid) {
      for (const err of waitlistGuard.errors) {
        diagnostics.push(
          createMappingDiagnostic({
            code: MAPPING_DIAGNOSTIC_CODE.UNSUPPORTED_FORMAT_POLICY,
            path: err.path,
            message: err.message,
            severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
            sourceType: "IndividualEntry",
            sourceId: String(entry.id),
            metadata: { participantErrorCode: err.code },
          })
        );
      }
    }
  }

  // OD-02: optional duplicate detection when sibling entries provided
  if (Array.isArray(context.siblingEntries) && competitionEntry) {
    const mappedSiblings = context.siblingEntries
      .map((sib) => {
        const r = mapIndividualEntry(sib, {
          competitionId,
          playerById,
          // prevent recursion on siblings
          siblingEntries: undefined,
        });
        return r.success ? r.value?.entry : null;
      })
      .filter(Boolean);
    const dup = detectDuplicateActiveEntryScopes([competitionEntry, ...mappedSiblings]);
    if (!dup.valid) {
      diagnostics.push(
        createMappingDiagnostic({
          code: MAPPING_DIAGNOSTIC_CODE.DUPLICATE_ACTIVE_ENTRY,
          path: "entry.scope",
          message: "Duplicate active entry scope detected (OD-02) — adapters must not merge",
          severity: MAPPING_DIAGNOSTIC_SEVERITY.WARNING,
          sourceType: "IndividualEntry",
          sourceId: String(entry.id),
          metadata: { errorCodes: dup.errors.map((e) => e.code) },
        })
      );
    }
  }

  void before;
  return finalizeMappingResult({
    success: diagnostics.every((d) => d.severity !== MAPPING_DIAGNOSTIC_SEVERITY.ERROR),
    value: {
      registration,
      entry: competitionEntry,
      seedLockedRating:
        context.seedLocked === true && typeof entry.rating === "number"
          ? createSeedLockedRatingSnapshot({
              competitionId,
              subjectKind: "entry",
              subjectId: String(entry.id),
              rating: entry.rating,
              lockedAt: context.seedLockedAt || entry.registeredAt || new Date(0).toISOString(),
            })
          : null,
    },
    diagnostics,
    sourceType: "IndividualEntry",
    sourceId: String(entry.id),
    sourceVersion: SOURCE_VERSION,
  });
}

/**
 * Map division (group) and category (event) separately (OD-07).
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 */
export function mapIndividualClassification(source, context = {}) {
  const src = asObject(source);
  const diagnostics = [];
  if (!src) {
    return finalizeMappingResult({
      success: false,
      diagnostics: [
        createMappingDiagnostic({
          code: MAPPING_DIAGNOSTIC_CODE.UNSUPPORTED_SOURCE_TYPE,
          path: "",
          message: "Classification source must be an object",
          severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
          sourceType: "IndividualClassification",
        }),
      ],
      sourceType: "IndividualClassification",
      sourceVersion: SOURCE_VERSION,
    });
  }

  const competitionId = String(
    context.competitionId || context.tournamentId || src.tournamentId || src.competitionId || ""
  ).trim();

  if (!competitionId) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID,
        path: "competitionId",
        message: "competitionId required",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "IndividualClassification",
        sourceId: String(src.id || src.groupId || src.eventId || ""),
      })
    );
  }

  const division =
    src.groupId || src.divisionId || src.entity === "division"
      ? createCompetitionDivision({
          id: String(src.groupId || src.divisionId || src.id || ""),
          competitionId,
          name: String(src.groupName || src.divisionName || src.name || ""),
          categoryIds: Array.isArray(src.categoryIds) ? src.categoryIds.map(String) : [],
        })
      : null;

  const category =
    src.eventId || src.categoryId || src.eventType || src.entity === "category"
      ? createCompetitionCategory({
          id: String(src.eventId || src.categoryId || src.id || src.code || ""),
          competitionId,
          code: String(src.code || src.eventType || src.eventId || src.categoryId || ""),
          label: src.eventName || src.categoryLabel || src.label || src.name || null,
        })
      : null;

  if (!division && !category) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_DIVISION_REFERENCE,
        path: "",
        message: "Neither division nor category could be resolved",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "IndividualClassification",
      })
    );
  }

  if (division) {
    const d = validateDivision(division);
    if (!d.valid) {
      for (const err of d.errors) {
        diagnostics.push(
          createMappingDiagnostic({
            code: MAPPING_DIAGNOSTIC_CODE.MISSING_DIVISION_REFERENCE,
            path: err.path,
            message: err.message,
            severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
            sourceType: "IndividualClassification",
            metadata: { participantErrorCode: err.code },
          })
        );
      }
    }
  }

  if (category) {
    const c = validateCategory(category);
    if (!c.valid) {
      for (const err of c.errors) {
        diagnostics.push(
          createMappingDiagnostic({
            code: MAPPING_DIAGNOSTIC_CODE.MISSING_CATEGORY_REFERENCE,
            path: err.path,
            message: err.message,
            severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
            sourceType: "IndividualClassification",
            metadata: { participantErrorCode: err.code },
          })
        );
      }
    }
  }

  return finalizeMappingResult({
    success: diagnostics.every((d) => d.severity !== MAPPING_DIAGNOSTIC_SEVERITY.ERROR),
    value: { division, category },
    diagnostics,
    sourceType: "IndividualClassification",
    sourceId: String(src.id || src.groupId || src.eventId || ""),
    sourceVersion: SOURCE_VERSION,
  });
}

export function compareIndividualEntryParity(legacyEntry, mappingResult) {
  const findings = [];
  if (!mappingResult?.success) {
    return [
      createParityFinding({
        dimension: "entry",
        classification: PARITY_CLASSIFICATION.MAPPING_FAILURE,
        path: "",
        message: "Individual entry mapping failed",
      }),
    ];
  }

  const legacy = asObject(legacyEntry) || {};
  const { registration, entry } = mappingResult.value || {};
  const isWaitlisted = String(legacy.status || "").toLowerCase() === "waitlisted";

  if (isWaitlisted) {
    if (registration?.status === COMPETITION_REGISTRATION_STATUS.WAITLISTED && !entry) {
      findings.push(
        createParityFinding({
          dimension: "entry",
          classification: PARITY_CLASSIFICATION.EXACT,
          path: "waitlist",
          message: "Waitlisted registration mapped without active Entry (OD-10)",
        })
      );
    } else {
      findings.push(
        createParityFinding({
          dimension: "entry",
          classification: PARITY_CLASSIFICATION.BLOCKER,
          path: "waitlist",
          message: "Waitlist incorrectly produced an Entry or wrong registration status",
          legacyValue: legacy.status,
          canonicalValue: { registrationStatus: registration?.status, hasEntry: Boolean(entry) },
        })
      );
    }
    return findings;
  }

  if (entry && String(entry.id) === String(legacy.id)) {
    findings.push(
      createParityFinding({
        dimension: "entry",
        classification: PARITY_CLASSIFICATION.EXACT,
        path: "id",
        message: "Entry id preserved",
        legacyValue: legacy.id,
        canonicalValue: entry.id,
      })
    );
  }

  if (entry && String(entry.competitionId) === String(legacy.tournamentId || legacy.competitionId)) {
    findings.push(
      createParityFinding({
        dimension: "entry",
        classification: PARITY_CLASSIFICATION.SEMANTIC_MATCH,
        path: "competitionId",
        message: "tournamentId → competitionId",
        legacyValue: legacy.tournamentId,
        canonicalValue: entry.competitionId,
      })
    );
  }

  if (entry?.divisionId != null || entry?.categoryId != null) {
    findings.push(
      createParityFinding({
        dimension: "entry",
        classification: PARITY_CLASSIFICATION.SEMANTIC_MATCH,
        path: "divisionId|categoryId",
        message: "Division and category kept as separate fields (OD-07)",
        legacyValue: { groupId: legacy.groupId, eventId: legacy.eventId },
        canonicalValue: { divisionId: entry.divisionId, categoryId: entry.categoryId },
      })
    );
  }

  if (entry?.extensions?.payload?.partnerInviteToken) {
    findings.push(
      createParityFinding({
        dimension: "entry",
        classification: PARITY_CLASSIFICATION.EXPECTED_FORMAT_EXTENSION,
        path: "extensions.partnerInviteToken",
        message: "Partner invite retained as Format extension",
      })
    );
  }

  return findings;
}

export function compareIndividualPlayerParity(legacyPlayer, mappingResult) {
  if (!mappingResult?.success) {
    return [
      createParityFinding({
        dimension: "identity",
        classification: PARITY_CLASSIFICATION.MAPPING_FAILURE,
        path: "",
        message: "Player mapping failed",
      }),
    ];
  }
  const player = asObject(legacyPlayer) || {};
  return compareIdentityParity({
    legacyPersonId: player.id,
    canonicalPersonId: mappingResult.value?.person?.id,
    guestOrExternal:
      player.playerType === "guest" ||
      player.isGuest === true ||
      player.playerType === "external",
    canonicalKind: mappingResult.value?.person?.kind,
  });
}
