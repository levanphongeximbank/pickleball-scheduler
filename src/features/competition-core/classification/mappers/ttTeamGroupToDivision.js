import { createCompetitionDivision } from "../divisions/createCompetitionDivision.js";
import { CLASSIFICATION_ERROR_CODE } from "../errors/errorCodes.js";
import { classificationOk, classificationWarning } from "../errors/classificationError.js";
import { normalizeClassificationCode } from "../keys/normalizeCode.js";

/**
 * Pure map: TT team group → CompetitionDivision descriptor.
 * Does not import team-tournament engines.
 *
 * @param {{
 *   id?: string,
 *   groupId?: string,
 *   name?: string,
 *   label?: string,
 *   code?: string,
 *   tenantId?: string,
 *   competitionId?: string,
 *   tournamentId?: string,
 *   [key: string]: unknown,
 * }} source
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function mapTtTeamGroupToDivision(source = {}) {
  const warnings = [];
  const label = String(source.name || source.label || "").trim();
  const rawCode = source.code || label || source.id || source.groupId || "";
  const codeResult = normalizeClassificationCode(String(rawCode).replace(/\s+/g, "_"));

  if (!codeResult.ok) {
    warnings.push(
      classificationWarning(
        CLASSIFICATION_ERROR_CODE.MAPPING_UNSUPPORTED,
        "code",
        "TT team group code could not be normalized; using fallback",
        { rawCode: String(rawCode) }
      )
    );
  }

  const code = codeResult.ok
    ? /** @type {string} */ (codeResult.value)
    : `tt_group_${String(source.id || source.groupId || "unknown").toLowerCase()}`;

  const division = createCompetitionDivision({
    id: String(source.id || source.groupId || ""),
    tenantId: String(source.tenantId || ""),
    competitionId: String(source.competitionId || source.tournamentId || ""),
    code,
    name: label || code,
    poolSizeMetadata: {
      targetPoolSize: Number.isFinite(Number(source.targetPoolSize))
        ? Number(source.targetPoolSize)
        : null,
      maxPoolSize: Number.isFinite(Number(source.maxPoolSize)) ? Number(source.maxPoolSize) : null,
      advanceCount: Number.isFinite(Number(source.advanceCount))
        ? Number(source.advanceCount)
        : null,
    },
    extensions: {
      formatKey: "team_tournament",
      payload: {
        legacyTeamGroupId: source.id || source.groupId || null,
        unknownFields: preserveUnknown(source, [
          "id",
          "groupId",
          "name",
          "label",
          "code",
          "tenantId",
          "competitionId",
          "tournamentId",
          "targetPoolSize",
          "maxPoolSize",
          "advanceCount",
        ]),
      },
    },
  });

  return classificationOk(division, warnings);
}

/**
 * @param {Record<string, unknown>} source
 * @param {string[]} knownKeys
 * @returns {Record<string, unknown>}
 */
function preserveUnknown(source, knownKeys) {
  const known = new Set(knownKeys);
  const out = {};
  for (const key of Object.keys(source || {}).sort()) {
    if (!known.has(key)) {
      out[key] = source[key];
    }
  }
  return out;
}
