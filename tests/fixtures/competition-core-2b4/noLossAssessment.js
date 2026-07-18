/**
 * Phase 2B.4 — no-loss semantic classification for mapping evidence.
 * Test/docs helper only — not a Production API.
 */

export const NO_LOSS_CLASSIFICATION = Object.freeze({
  PRESERVED: "PRESERVED",
  PRESERVED_IN_EXTENSION: "PRESERVED_IN_EXTENSION",
  OPTIONAL_MISSING: "OPTIONAL_MISSING",
  WARNING: "WARNING",
  FAILURE: "FAILURE",
  BLOCKER: "BLOCKER",
});

/**
 * @param {Object} input
 * @returns {{ field: string, classification: string, message: string, legacyValue: unknown, canonicalValue: unknown }}
 */
export function classifyNoLoss(input = {}) {
  return {
    field: String(input.field || ""),
    classification: String(input.classification || NO_LOSS_CLASSIFICATION.WARNING),
    message: String(input.message || ""),
    legacyValue: input.legacyValue !== undefined ? input.legacyValue : null,
    canonicalValue: input.canonicalValue !== undefined ? input.canonicalValue : null,
  };
}

/**
 * Semantic no-loss checks for a Team Tournament bundle mapping.
 * @param {Record<string, unknown>} legacyTeam
 * @param {Record<string, unknown>|null} mapped
 * @param {import('../../src/tournament/adapters/competition-core/shared/mappingResult.js').MappingResult} result
 */
export function assessTeamBundleNoLoss(legacyTeam, mapped, result) {
  /** @type {ReturnType<typeof classifyNoLoss>[]} */
  const rows = [];
  if (!result?.success || !mapped) {
    rows.push(
      classifyNoLoss({
        field: "bundle",
        classification: NO_LOSS_CLASSIFICATION.FAILURE,
        message: "Mapping failed",
      })
    );
    return rows;
  }

  const team = mapped.team;
  const roster = mapped.roster;
  const lineup = mapped.lineup;

  rows.push(
    classifyNoLoss({
      field: "team.identity",
      classification:
        String(legacyTeam.id) === String(team?.id)
          ? NO_LOSS_CLASSIFICATION.PRESERVED
          : NO_LOSS_CLASSIFICATION.BLOCKER,
      legacyValue: legacyTeam.id,
      canonicalValue: team?.id,
      message: "Team id",
    })
  );

  rows.push(
    classifyNoLoss({
      field: "captain.role",
      classification:
        String(legacyTeam.captainPlayerId || "") === String(team?.captainRef?.id || "")
          ? NO_LOSS_CLASSIFICATION.PRESERVED
          : NO_LOSS_CLASSIFICATION.BLOCKER,
      legacyValue: legacyTeam.captainPlayerId,
      canonicalValue: team?.captainRef?.id,
      message: "Captain identity",
    })
  );

  const legacyMembers = Array.isArray(legacyTeam.playerIds) ? legacyTeam.playerIds.map(String) : [];
  const canonicalMembers = (roster?.members || []).map((m) => String(m.person?.id || ""));
  rows.push(
    classifyNoLoss({
      field: "roster.membership",
      classification:
        legacyMembers.length === canonicalMembers.length &&
        legacyMembers.every((id) => canonicalMembers.includes(id))
          ? NO_LOSS_CLASSIFICATION.PRESERVED
          : NO_LOSS_CLASSIFICATION.FAILURE,
      legacyValue: legacyMembers,
      canonicalValue: canonicalMembers,
      message: "Roster member identities",
    })
  );

  if (legacyTeam.locked === true || legacyTeam.rosterStatus === "ROSTER_LOCKED") {
    rows.push(
      classifyNoLoss({
        field: "roster.lockState",
        classification:
          roster?.status === "ROSTER_LOCKED"
            ? NO_LOSS_CLASSIFICATION.PRESERVED
            : NO_LOSS_CLASSIFICATION.BLOCKER,
        legacyValue: true,
        canonicalValue: roster?.status,
        message: "Roster lock",
      })
    );
  }

  if (team?.extensions?.payload) {
    rows.push(
      classifyNoLoss({
        field: "format.teamExtensions",
        classification: NO_LOSS_CLASSIFICATION.PRESERVED_IN_EXTENSION,
        message: "TT-specific fields in extensions",
        canonicalValue: team.extensions.formatKey,
      })
    );
  }

  if (lineup?.extensions?.payload?.hiddenLineupPolicyRef) {
    rows.push(
      classifyNoLoss({
        field: "lineup.hiddenPolicy",
        classification: NO_LOSS_CLASSIFICATION.PRESERVED_IN_EXTENSION,
        message: "Hidden lineup remains Format-owned",
      })
    );
  }

  if (lineup && Array.isArray(lineup.revisions) && lineup.revisions.length >= 1) {
    rows.push(
      classifyNoLoss({
        field: "lineup.revision",
        classification: NO_LOSS_CLASSIFICATION.PRESERVED,
        legacyValue: legacyTeam.lineupRevisionHint ?? null,
        canonicalValue: lineup.revision,
        message: "Lineup revision preserved",
      })
    );
  }

  rows.push(
    classifyNoLoss({
      field: "audit.metadata",
      classification:
        team?.audit && typeof team.audit === "object"
          ? NO_LOSS_CLASSIFICATION.PRESERVED
          : NO_LOSS_CLASSIFICATION.OPTIONAL_MISSING,
      message: "Audit metadata present on team",
    })
  );

  return rows;
}

/**
 * @param {Record<string, unknown>} legacyEntry
 * @param {{ registration?: unknown, entry?: unknown|null, seedLockedRating?: unknown }} mapped
 * @param {{ success: boolean }} result
 */
export function assessIndividualEntryNoLoss(legacyEntry, mapped, result) {
  /** @type {ReturnType<typeof classifyNoLoss>[]} */
  const rows = [];
  if (!result?.success) {
    return [
      classifyNoLoss({
        field: "entry",
        classification: NO_LOSS_CLASSIFICATION.FAILURE,
        message: "Entry mapping failed",
      }),
    ];
  }

  const isWaitlisted = String(legacyEntry.status || "").toLowerCase() === "waitlisted";
  if (isWaitlisted) {
    rows.push(
      classifyNoLoss({
        field: "registration.status",
        classification:
          mapped.registration?.status === "WAITLISTED" && !mapped.entry
            ? NO_LOSS_CLASSIFICATION.PRESERVED
            : NO_LOSS_CLASSIFICATION.BLOCKER,
        message: "Waitlist does not activate Entry",
        legacyValue: legacyEntry.status,
        canonicalValue: {
          registration: mapped.registration?.status,
          entry: mapped.entry,
        },
      })
    );
    return rows;
  }

  rows.push(
    classifyNoLoss({
      field: "entry.identity",
      classification:
        String(legacyEntry.id) === String(mapped.entry?.id)
          ? NO_LOSS_CLASSIFICATION.PRESERVED
          : NO_LOSS_CLASSIFICATION.BLOCKER,
      legacyValue: legacyEntry.id,
      canonicalValue: mapped.entry?.id,
      message: "Entry id",
    })
  );

  rows.push(
    classifyNoLoss({
      field: "competition.identity",
      classification:
        String(legacyEntry.tournamentId || legacyEntry.competitionId || "") ===
        String(mapped.entry?.competitionId || "")
          ? NO_LOSS_CLASSIFICATION.PRESERVED
          : NO_LOSS_CLASSIFICATION.BLOCKER,
      legacyValue: legacyEntry.tournamentId,
      canonicalValue: mapped.entry?.competitionId,
      message: "competitionId",
    })
  );

  rows.push(
    classifyNoLoss({
      field: "division",
      classification:
        String(legacyEntry.groupId || "") === String(mapped.entry?.divisionId || "")
          ? NO_LOSS_CLASSIFICATION.PRESERVED
          : NO_LOSS_CLASSIFICATION.WARNING,
      legacyValue: legacyEntry.groupId,
      canonicalValue: mapped.entry?.divisionId,
      message: "Division separate from category",
    })
  );

  rows.push(
    classifyNoLoss({
      field: "category",
      classification:
        String(legacyEntry.eventId || "") === String(mapped.entry?.categoryId || "")
          ? NO_LOSS_CLASSIFICATION.PRESERVED
          : NO_LOSS_CLASSIFICATION.WARNING,
      legacyValue: legacyEntry.eventId,
      canonicalValue: mapped.entry?.categoryId,
      message: "Category separate from division",
    })
  );

  if (mapped.entry?.ratingSnapshot) {
    rows.push(
      classifyNoLoss({
        field: "rating.snapshot",
        classification: NO_LOSS_CLASSIFICATION.PRESERVED,
        legacyValue: legacyEntry.rating,
        canonicalValue: mapped.entry.ratingSnapshot.rating,
        message: "Rating snapshot",
      })
    );
  } else if (legacyEntry.rating != null) {
    rows.push(
      classifyNoLoss({
        field: "rating.snapshot",
        classification: NO_LOSS_CLASSIFICATION.OPTIONAL_MISSING,
        message: "Rating present on legacy but snapshot optional path",
        legacyValue: legacyEntry.rating,
      })
    );
  }

  if (mapped.seedLockedRating) {
    rows.push(
      classifyNoLoss({
        field: "seed.snapshot",
        classification: NO_LOSS_CLASSIFICATION.PRESERVED,
        canonicalValue: mapped.seedLockedRating.rating,
        message: "Seed-locked rating snapshot",
      })
    );
  }

  if (mapped.entry?.extensions?.payload?.partnerInviteToken) {
    rows.push(
      classifyNoLoss({
        field: "partner.invite",
        classification: NO_LOSS_CLASSIFICATION.PRESERVED_IN_EXTENSION,
        message: "Partner invite Format-owned",
      })
    );
  }

  if (mapped.registration?.audit || mapped.entry?.audit) {
    rows.push(
      classifyNoLoss({
        field: "audit.metadata",
        classification: NO_LOSS_CLASSIFICATION.PRESERVED,
        message: "Audit metadata",
      })
    );
  }

  return rows;
}

/**
 * @param {ReturnType<typeof classifyNoLoss>[]} rows
 */
export function summarizeNoLoss(rows = []) {
  const blockers = rows.filter((r) => r.classification === NO_LOSS_CLASSIFICATION.BLOCKER);
  const failures = rows.filter((r) => r.classification === NO_LOSS_CLASSIFICATION.FAILURE);
  return {
    ok: blockers.length === 0 && failures.length === 0,
    blockers,
    failures,
    preserved: rows.filter(
      (r) =>
        r.classification === NO_LOSS_CLASSIFICATION.PRESERVED ||
        r.classification === NO_LOSS_CLASSIFICATION.PRESERVED_IN_EXTENSION
    ),
    warnings: rows.filter(
      (r) =>
        r.classification === NO_LOSS_CLASSIFICATION.WARNING ||
        r.classification === NO_LOSS_CLASSIFICATION.OPTIONAL_MISSING
    ),
  };
}
