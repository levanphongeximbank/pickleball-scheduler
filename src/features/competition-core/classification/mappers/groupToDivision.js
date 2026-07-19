import { createCompetitionDivision } from "../divisions/createCompetitionDivision.js";
import { CLASSIFICATION_ERROR_CODE } from "../errors/errorCodes.js";
import { classificationOk, classificationWarning } from "../errors/classificationError.js";
import { normalizeClassificationCode } from "../keys/normalizeCode.js";

/**
 * Pure map: Individual tournament group (“bảng”) → CompetitionDivision descriptor.
 *
 * @param {{
 *   id?: string,
 *   groupId?: string,
 *   label?: string,
 *   name?: string,
 *   tenantId?: string,
 *   competitionId?: string,
 *   tournamentId?: string,
 *   eventId?: string,
 *   code?: string,
 *   [key: string]: unknown,
 * }} source
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function mapGroupToDivision(source = {}) {
  const warnings = [];
  const label = String(source.label || source.name || "").trim();
  const rawCode = source.code || label || source.id || source.groupId || "";
  const codeResult = normalizeClassificationCode(String(rawCode).replace(/\s+/g, "_"));

  if (!codeResult.ok) {
    warnings.push(
      classificationWarning(
        CLASSIFICATION_ERROR_CODE.MAPPING_UNSUPPORTED,
        "code",
        "Group label/code could not be normalized; using fallback group code",
        { rawCode: String(rawCode) }
      )
    );
  }

  const code = codeResult.ok
    ? /** @type {string} */ (codeResult.value)
    : `group_${String(source.id || source.groupId || "unknown").toLowerCase()}`;

  const division = createCompetitionDivision({
    id: String(source.id || source.groupId || ""),
    tenantId: String(source.tenantId || ""),
    competitionId: String(source.competitionId || source.tournamentId || ""),
    code,
    name: label || code,
    description: source.eventId ? `group under event ${source.eventId}` : null,
    extensions: {
      formatKey: "individual_tournament",
      payload: {
        legacyGroupId: source.id || source.groupId || null,
        legacyEventId: source.eventId || null,
        unknownFields: preserveUnknown(source, [
          "id",
          "groupId",
          "label",
          "name",
          "tenantId",
          "competitionId",
          "tournamentId",
          "eventId",
          "code",
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
