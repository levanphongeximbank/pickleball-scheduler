import { getGlossaryEntry, RATING_GLOSSARY } from "./ratingGlossary.js";
import { normalizeDomainCode } from "./domainCodes.js";

/**
 * Default UI format: English term (chú thích tiếng Việt)
 */
export function formatRatingTerm(code, { style = "default", strict = false } = {}) {
  const raw = String(code ?? "").trim().toLowerCase();
  let entry = getGlossaryEntry(raw);
  if (!entry) {
    const normalized = normalizeDomainCode(code);
    if (normalized) entry = getGlossaryEntry(normalized);
  }
  if (!entry) {
    if (strict) {
      throw new Error(`Missing glossary entry for code: ${raw}`);
    }
    return raw;
  }
  if (style === "vi_only") {
    return entry.term_vi;
  }
  if (style === "en_only") {
    return entry.term_en;
  }
  return `${entry.term_en} (${entry.term_vi})`;
}

export function formatDomainList(codes, separator = ", ") {
  if (!Array.isArray(codes) || !codes.length) return "—";
  return codes
    .map((code) => formatRatingTerm(code))
    .join(separator);
}

const PLACEHOLDER_RE = /\{\{([a-z0-9_]+)\}\}/gi;

/**
 * Resolve {{term_code}} placeholders in question prompts/anchors using glossary.
 */
export function resolvePromptText(text, { strict = true } = {}) {
  if (!text || typeof text !== "string") return text;
  return text.replace(PLACEHOLDER_RE, (_, code) => formatRatingTerm(code, { strict }));
}

export function resolveQuestionDisplay(question) {
  if (!question) return null;
  return {
    ...question,
    displayPrompt: resolvePromptText(question.prompt),
    displayAnchors: (question.anchors ?? []).map((a) => resolvePromptText(a)),
  };
}

export function formatWarningFlag(flag) {
  if (!flag || typeof flag !== "object") return String(flag ?? "");
  if (flag.type === "CONTRADICTION") {
    return `${formatRatingTerm("contradiction")}: ${flag.questionId}`;
  }
  return formatRatingTerm(flag.type) || String(flag.type ?? "");
}

export function getRequiredGlossaryCodesForDomains(domainCodes) {
  return domainCodes.filter((code) => Boolean(getGlossaryEntry(code)));
}

export function listMissingGlossaryCodes(requiredCodes) {
  return requiredCodes.filter((code) => !getGlossaryEntry(code));
}

export function getAllGlossaryTermCodes() {
  return Object.keys(RATING_GLOSSARY);
}
