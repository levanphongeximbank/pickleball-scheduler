/**
 * Legacy preset/mode → canonical CompetitionTemplate candidate projector (CM-02).
 *
 * Direction: legacy_tournament_mode_or_preset → CM-02 template identity candidate.
 * Does NOT cast legacy objects into CompetitionTemplateDefinition.
 * Does NOT mutate legacy. Does NOT write production runtime.
 * Ambiguous mappings → typed incompatibility / ambiguity errors.
 */

import { COMPETITION_TEMPLATE_INITIAL_VERSION } from "../constants/index.js";
import { COMPETITION_TEMPLATE_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
  deepFreeze,
  isNonEmptyString,
} from "../contracts/index.js";
import { LEGACY_MODE_TO_TEMPLATE_ID } from "../catalog/staticCatalog.js";

/**
 * Compatibility statement for legacy mapping (read-only).
 */
export const LEGACY_TEMPLATE_COMPATIBILITY = Object.freeze({
  canonicalTemplateSource: "cm-02-capability-local-static-catalog",
  transitionalSource: "legacy TOURNAMENT_MODE / FORMAT_PRESET / setup presets",
  readCompatibility: "projectLegacyPresetToCompetitionTemplateCandidate",
  writeCompatibility: Object.freeze(["deferred", "no dual-write", "no tournamentService mutation"]),
  unsupportedMappings: Object.freeze([
    "official_open alone",
    "official_ai_balance alone",
    "FORMAT_PRESET.custom",
    "REGULATION_TEMPLATES",
    "SESSION_TEMPLATES",
    "CRM message templates",
  ]),
  deferredCutover: "Integrator phase — production UI/API continues on tournamentService",
});

/**
 * Safe legacy mode strings that map 1:1 to a global CM-02 template.
 */
const SAFE_MODE_MAP = Object.freeze({
  daily_play: LEGACY_MODE_TO_TEMPLATE_ID.daily_play,
  internal_tournament: LEGACY_MODE_TO_TEMPLATE_ID.internal_tournament,
  official_tournament: LEGACY_MODE_TO_TEMPLATE_ID.official_tournament,
});

/**
 * Ambiguous official sub-modes — not standalone competition templates.
 */
const AMBIGUOUS_OFFICIAL_SUBMODES = Object.freeze([
  "official_open",
  "official_ai_balance",
]);

/**
 * Project a legacy preset/mode descriptor to a CM-02 template identity candidate.
 *
 * Accepted input shapes (explicit):
 * - { mode: "daily_play"|"internal_tournament"|"official_tournament" }
 * - { mode: "team_tournament", formatPreset: "mlp_4" }
 * - { tournamentMode: <same as mode> } (alias)
 *
 * Rejected:
 * - missing mode
 * - unknown mode
 * - official_open / official_ai_balance without parent official_tournament framing as sole identity
 * - team_tournament without mlp_4 (or with custom)
 * - regulation/session/crm template ids
 *
 * @param {object} legacyPreset
 * @param {{ tenantId?: string }} [options]
 * @returns {import("../contracts/validation.js").CompetitionTemplateValidationResult}
 */
export function projectLegacyPresetToCompetitionTemplateCandidate(
  legacyPreset,
  options = {}
) {
  const snap = snapshotInput(legacyPreset);
  void snap;

  if (!legacyPreset || typeof legacyPreset !== "object") {
    return validationFail([
      createFieldError(
        "legacyPreset",
        COMPETITION_TEMPLATE_ERROR_CODE.LEGACY_INCOMPATIBLE,
        "legacy preset/mode object is required",
        {}
      ),
    ]);
  }

  const raw = /** @type {Record<string, unknown>} */ (legacyPreset);

  // Reject known non-competition "template" namespaces
  if (isNonEmptyString(raw.regulationTemplateId) || isNonEmptyString(raw.sessionTemplateId)) {
    return validationFail([
      createFieldError(
        "legacyPreset",
        COMPETITION_TEMPLATE_ERROR_CODE.LEGACY_INCOMPATIBLE,
        "regulation/session UI templates are not competition templates",
        {
          regulationTemplateId: raw.regulationTemplateId,
          sessionTemplateId: raw.sessionTemplateId,
        }
      ),
    ]);
  }
  if (isNonEmptyString(raw.crmTemplateId)) {
    return validationFail([
      createFieldError(
        "legacyPreset",
        COMPETITION_TEMPLATE_ERROR_CODE.LEGACY_INCOMPATIBLE,
        "CRM message templates are not competition templates",
        { crmTemplateId: raw.crmTemplateId }
      ),
    ]);
  }

  const modeRaw = raw.mode ?? raw.tournamentMode ?? raw.competitionType;
  if (!isNonEmptyString(modeRaw)) {
    // Sole official sub-mode without parent mode
    if (isNonEmptyString(raw.officialMode)) {
      return validationFail([
        createFieldError(
          "officialMode",
          COMPETITION_TEMPLATE_ERROR_CODE.LEGACY_AMBIGUOUS,
          "officialMode alone is ambiguous; requires explicit official_tournament mode",
          { officialMode: raw.officialMode }
        ),
      ]);
    }
    return validationFail([
      createFieldError(
        "mode",
        COMPETITION_TEMPLATE_ERROR_CODE.LEGACY_UNKNOWN,
        "legacy mode/tournamentMode is required",
        {}
      ),
    ]);
  }

  const mode = String(modeRaw).trim();

  if (AMBIGUOUS_OFFICIAL_SUBMODES.includes(mode)) {
    return validationFail([
      createFieldError(
        "mode",
        COMPETITION_TEMPLATE_ERROR_CODE.LEGACY_AMBIGUOUS,
        "official sub-mode cannot map to a single competition template",
        { mode }
      ),
    ]);
  }

  if (mode === "team_tournament") {
    const formatPreset = raw.formatPreset ?? raw.format_preset;
    if (formatPreset == null || formatPreset === "") {
      return validationFail([
        createFieldError(
          "formatPreset",
          COMPETITION_TEMPLATE_ERROR_CODE.LEGACY_AMBIGUOUS,
          "team_tournament without formatPreset is ambiguous",
          { mode }
        ),
      ]);
    }
    if (String(formatPreset).trim() === "custom") {
      return validationFail([
        createFieldError(
          "formatPreset",
          COMPETITION_TEMPLATE_ERROR_CODE.LEGACY_AMBIGUOUS,
          "FORMAT_PRESET.custom is an empty shell, not a competition template",
          { mode, formatPreset }
        ),
      ]);
    }
    if (String(formatPreset).trim() !== "mlp_4") {
      return validationFail([
        createFieldError(
          "formatPreset",
          COMPETITION_TEMPLATE_ERROR_CODE.LEGACY_UNKNOWN,
          "unsupported team tournament formatPreset for safe template mapping",
          { mode, formatPreset }
        ),
      ]);
    }
    return validationOk(
      deepFreeze({
        templateId: LEGACY_MODE_TO_TEMPLATE_ID.team_tournament_mlp_4,
        templateVersion: COMPETITION_TEMPLATE_INITIAL_VERSION,
        source: "legacy_mode_format_preset",
        legacyMode: mode,
        legacyFormatPreset: "mlp_4",
        tenantId: options.tenantId ?? null,
        mapping: "safe",
      }),
      {
        summary: "Legacy team_tournament+mlp_4 mapped to CM-02 template candidate.",
        reasons: Object.freeze([
          "mode=team_tournament",
          "formatPreset=mlp_4",
          `templateId=${LEGACY_MODE_TO_TEMPLATE_ID.team_tournament_mlp_4}`,
        ]),
      }
    );
  }

  if (Object.prototype.hasOwnProperty.call(SAFE_MODE_MAP, mode)) {
    // officialMode present with official_tournament is OK as metadata (CM-04), not identity.
    if (
      mode === "official_tournament" &&
      isNonEmptyString(raw.officialMode) &&
      !AMBIGUOUS_OFFICIAL_SUBMODES.includes(String(raw.officialMode).trim()) &&
      String(raw.officialMode).trim() !== "official_open" &&
      String(raw.officialMode).trim() !== "official_ai_balance"
    ) {
      // unknown officialMode with official_tournament — still map mode, warn via details
    }

    return validationOk(
      deepFreeze({
        templateId: SAFE_MODE_MAP[mode],
        templateVersion: COMPETITION_TEMPLATE_INITIAL_VERSION,
        source: "legacy_tournament_mode",
        legacyMode: mode,
        legacyOfficialMode: isNonEmptyString(raw.officialMode)
          ? String(raw.officialMode).trim()
          : null,
        tenantId: options.tenantId ?? null,
        mapping: "safe",
        note:
          mode === "official_tournament" && isNonEmptyString(raw.officialMode)
            ? "officialMode retained as CM-04 configuration hint; not part of template identity"
            : null,
      }),
      {
        summary: `Legacy mode ${mode} mapped to CM-02 template candidate.`,
        reasons: Object.freeze([
          `mode=${mode}`,
          `templateId=${SAFE_MODE_MAP[mode]}`,
        ]),
      }
    );
  }

  return validationFail([
    createFieldError(
      "mode",
      COMPETITION_TEMPLATE_ERROR_CODE.LEGACY_UNKNOWN,
      "unknown legacy tournament mode cannot be mapped safely",
      { mode }
    ),
  ]);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLegacyTemplateProjectionResult(value) {
  return Boolean(value) && typeof value === "object" && "ok" in /** @type {object} */ (value);
}
