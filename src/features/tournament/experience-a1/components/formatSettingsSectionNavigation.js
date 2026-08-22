/**
 * Official Content → Thiết kế thể thức — subsection (Groups 1–6) navigation.
 * URL query is the presentation authority for refresh / Back / Forward.
 * Does not persist into Tournament, events[].competitionRules, or localStorage.
 */

export const FORMAT_SETTINGS_SECTION_QUERY_KEY = "section";

export const FORMAT_SETTINGS_SECTION = Object.freeze({
  CONTENT_REGISTRATION: "content-registration",
  STRUCTURE: "structure",
  MATCH_RULES: "match-rules",
  RANKING: "ranking",
  OPS: "ops",
  OPS_INFRA: "ops-infra",
});

export const FORMAT_SETTINGS_SECTION_IDS = Object.freeze(
  Object.values(FORMAT_SETTINGS_SECTION)
);

/** Prior UI alias: "change-end" collapsed into Group 3 match-rules. */
const SECTION_ALIASES = Object.freeze({
  "change-end": FORMAT_SETTINGS_SECTION.MATCH_RULES,
});

/** Legacy URLs without ?section= open Group 3 (prior local-state default). */
export const FORMAT_SETTINGS_SECTION_DEFAULT = FORMAT_SETTINGS_SECTION.MATCH_RULES;

const SECTION_ID_SET = new Set(FORMAT_SETTINGS_SECTION_IDS);

function toSearchParams(searchParams) {
  return new URLSearchParams(
    searchParams && typeof searchParams.forEach === "function"
      ? searchParams
      : String(searchParams || "")
  );
}

export function readFormatSettingsSectionQuery(searchParams) {
  if (!searchParams || typeof searchParams.get !== "function") {
    return "";
  }
  return String(searchParams.get(FORMAT_SETTINGS_SECTION_QUERY_KEY) || "").trim();
}

/**
 * Project a subsection id into search params while preserving eventId, tab, etc.
 */
export function applyFormatSettingsSectionSearchParams(searchParams, sectionId) {
  const next = toSearchParams(searchParams);
  const resolved = resolveFormatSettingsSection(sectionId);
  next.set(FORMAT_SETTINGS_SECTION_QUERY_KEY, resolved.sectionId);
  return next;
}

/**
 * Resolve format-settings subsection from a raw query / click value.
 * Unknown values fail closed to the legacy default (match-rules).
 */
export function resolveFormatSettingsSection(requestedSectionId = "") {
  const raw = String(requestedSectionId || "").trim();
  if (!raw) {
    return {
      sectionId: FORMAT_SETTINGS_SECTION_DEFAULT,
      source: "default",
      valid: true,
      normalized: false,
    };
  }

  const aliased = SECTION_ALIASES[raw] || raw;
  if (SECTION_ID_SET.has(aliased)) {
    return {
      sectionId: aliased,
      source: raw === aliased ? "url" : "alias",
      valid: true,
      normalized: raw !== aliased,
    };
  }

  return {
    sectionId: FORMAT_SETTINGS_SECTION_DEFAULT,
    source: "fallback",
    valid: false,
    normalized: true,
  };
}
