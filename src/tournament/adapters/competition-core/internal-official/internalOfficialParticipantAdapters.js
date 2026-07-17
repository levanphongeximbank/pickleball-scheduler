/**
 * Internal / Official tournament mapping evidence adapters (Phase 2B.3).
 * Reuses Individual entry mapping; does not change runtime engines.
 */

import {
  COMPETITION_REGISTRATION_STATUS,
  createSeedLockedRatingSnapshot,
  createFormatExtension,
} from "../../../../features/competition-core/index.js";

import {
  mapIndividualEntry,
  mapIndividualPlayerToParticipant,
  mapIndividualClassification,
  compareIndividualEntryParity,
} from "../../../../features/individual-tournament/adapters/competition-core/index.js";

import {
  MAPPING_DIAGNOSTIC_CODE,
  MAPPING_DIAGNOSTIC_SEVERITY,
  createMappingDiagnostic,
  finalizeMappingResult,
  PARITY_CLASSIFICATION,
  createParityFinding,
} from "../shared/index.js";

const SOURCE_VERSION = "internal-official-v1";

/**
 * @param {"internal"|"official"} formatKind
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 */
export function mapInternalOrOfficialEntry(formatKind, source, context = {}) {
  const kind = formatKind === "official" ? "official" : "internal";
  const result = mapIndividualEntry(source, {
    ...context,
    seedLocked: context.seedLocked === true || kind === "official",
  });

  if (!result.success) {
    return result;
  }

  const registration = result.value?.registration
    ? {
        ...result.value.registration,
        extensions: createFormatExtension({
          formatKey: kind === "official" ? "official-tournament" : "internal-tournament",
          payload: {
            ...(result.value.registration.extensions?.payload || {}),
            formatKind: kind,
            openRegistration: kind === "official" ? Boolean(context.openRegistration) : false,
            btcDirectActive: kind === "internal" ? Boolean(context.btcDirectActive) : false,
          },
        }),
      }
    : null;

  const entry = result.value?.entry
    ? {
        ...result.value.entry,
        extensions: createFormatExtension({
          formatKey: kind === "official" ? "official-tournament" : "internal-tournament",
          payload: {
            ...(result.value.entry.extensions?.payload || {}),
            formatKind: kind,
            seedIdentity: context.seedIdentity || null,
          },
        }),
      }
    : null;

  let seedLockedRating = result.value?.seedLockedRating || null;
  if (!seedLockedRating && entry && typeof source?.rating === "number" && context.seedLocked) {
    seedLockedRating = createSeedLockedRatingSnapshot({
      competitionId: entry.competitionId,
      subjectKind: "entry",
      subjectId: entry.id,
      rating: source.rating,
      lockedAt: context.seedLockedAt || source.registeredAt || new Date(0).toISOString(),
    });
  }

  return finalizeMappingResult({
    success: true,
    value: { registration, entry, seedLockedRating, formatKind: kind },
    diagnostics: result.diagnostics,
    sourceType: kind === "official" ? "OfficialEntry" : "InternalEntry",
    sourceId: result.source?.id || null,
    sourceVersion: SOURCE_VERSION,
  });
}

export function mapInternalEntry(source, context = {}) {
  return mapInternalOrOfficialEntry("internal", source, context);
}

export function mapOfficialEntry(source, context = {}) {
  return mapInternalOrOfficialEntry("official", source, {
    ...context,
    openRegistration: context.openRegistration !== false,
  });
}

export function mapInternalMemberRegistration(source, context = {}) {
  return mapInternalEntry(source, { ...context, btcDirectActive: true });
}

export function mapOfficialOpenRegistration(source, context = {}) {
  return mapOfficialEntry(source, { ...context, openRegistration: true });
}

/**
 * Evidence bundle: registration + division/category + seed snapshot.
 * @param {Object} input
 */
export function mapInternalOfficialEvidenceBundle(input = {}) {
  const formatKind = input.formatKind === "official" ? "official" : "internal";
  const diagnostics = [];

  if (!input.entry) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_SOURCE_ID,
        path: "entry",
        message: "entry required for evidence bundle",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "InternalOfficialEvidence",
      })
    );
    return finalizeMappingResult({
      success: false,
      diagnostics,
      sourceType: "InternalOfficialEvidence",
      sourceVersion: SOURCE_VERSION,
    });
  }

  const entryResult = mapInternalOrOfficialEntry(formatKind, input.entry, input.context || {});
  diagnostics.push(...entryResult.diagnostics);

  let playerResult = null;
  if (input.player) {
    playerResult = mapIndividualPlayerToParticipant(input.player, {
      competitionId:
        input.context?.competitionId ||
        input.entry.tournamentId ||
        input.entry.competitionId,
      seedLocked: Boolean(input.context?.seedLocked),
    });
    diagnostics.push(...playerResult.diagnostics);
  }

  let classificationResult = null;
  if (input.classification) {
    classificationResult = mapIndividualClassification(input.classification, {
      competitionId:
        input.context?.competitionId ||
        input.entry.tournamentId ||
        input.entry.competitionId,
    });
    diagnostics.push(...classificationResult.diagnostics);
  }

  return finalizeMappingResult({
    success:
      entryResult.success &&
      (!playerResult || playerResult.success) &&
      (!classificationResult || classificationResult.success) &&
      diagnostics.every((d) => d.severity !== MAPPING_DIAGNOSTIC_SEVERITY.ERROR),
    value: {
      formatKind,
      entryMapping: entryResult.value,
      participant: playerResult?.value ?? null,
      classification: classificationResult?.value ?? null,
    },
    diagnostics,
    sourceType: "InternalOfficialEvidence",
    sourceId: String(input.entry.id || ""),
    sourceVersion: SOURCE_VERSION,
  });
}

export function compareInternalOfficialParity(legacyEntry, mappingResult) {
  const base = compareIndividualEntryParity(legacyEntry, {
    ...mappingResult,
    value: mappingResult?.value?.entryMapping || mappingResult?.value,
  });

  const findings = [...base];
  const formatKind = mappingResult?.value?.formatKind;
  if (formatKind) {
    findings.push(
      createParityFinding({
        dimension: "entry",
        classification: PARITY_CLASSIFICATION.EXPECTED_FORMAT_EXTENSION,
        path: "extensions.formatKind",
        message: `${formatKind} format metadata preserved in extensions`,
        canonicalValue: formatKind,
      })
    );
  }

  const seed = mappingResult?.value?.entryMapping?.seedLockedRating;
  if (seed) {
    findings.push(
      createParityFinding({
        dimension: "snapshot",
        classification: PARITY_CLASSIFICATION.SEMANTIC_MATCH,
        path: "seedLockedRating",
        message: "Seed rating snapshot mapped (OD-09)",
        canonicalValue: seed.rating,
      })
    );
  }

  const reg = mappingResult?.value?.entryMapping?.registration;
  if (reg?.status === COMPETITION_REGISTRATION_STATUS.WAITLISTED) {
    findings.push(
      createParityFinding({
        dimension: "entry",
        classification: PARITY_CLASSIFICATION.EXACT,
        path: "registration.status",
        message: "Waitlist preserved for internal/official",
      })
    );
  }

  return findings;
}
