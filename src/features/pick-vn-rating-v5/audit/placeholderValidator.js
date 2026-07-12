import { getAllQuestions } from "../assessment/assessmentScoringEngine.js";
import { RATING_GLOSSARY } from "../constants/ratingGlossary.js";
import { DOMAIN_CODE_ALIASES } from "../constants/domainCodes.js";
import { resolvePromptText, formatRatingTerm } from "../constants/terminology.js";

const PLACEHOLDER_RE = /\{\{([a-z0-9_]+)\}\}/g;
const NESTED_PLACEHOLDER_RE = /\{\{[^}]*\{\{/;

/** Bare English terms that must appear as {{code}} placeholders in user-facing bank text. */
const BANNED_BARE_ENGLISH = [
  /\bthird[- ]shot\b/i,
  /\bforehand\b/i,
  /\bbackhand\b/i,
  /\bbaseline\b/i,
  /\bdrive\b/i,
  /\brally\b/i,
  /\bvolley\b/i,
  /\bpoach\b/i,
  /\bstacking\b/i,
  /\bpop[- ]up\b/i,
  /\bspeed[- ]up\b/i,
  /\bcross[- ]court\b/i,
  /\bcounter[- ]attack\b/i,
  /\bput[- ]away\b/i,
  /\bmatch[- ]up\b/i,
  /\bfoot fault\b/i,
];

const ALLOWED_BARE = new Set([
  "pickleball", "mine", "yours", "switch", "middle", "line", "deep", "pace", "angle",
  "TB", "OK", "NVZ", "let", "replay", "fault", "double bounce", "vôi",
  "stagger", "formation", "coverage", "setup", "third", "HLV", "exp",
]);

function collectUserFacingStrings() {
  const strings = [];
  for (const q of getAllQuestions()) {
    strings.push({ id: q.id, field: "prompt", text: q.prompt });
    for (let i = 0; i < (q.anchors ?? []).length; i += 1) {
      strings.push({ id: q.id, field: `anchor_${i}`, text: q.anchors[i] });
    }
  }
  return strings;
}

export function extractPlaceholders(text) {
  if (!text) return [];
  const found = [];
  let match;
  const re = new RegExp(PLACEHOLDER_RE.source, "gi");
  while ((match = re.exec(text)) !== null) {
    found.push(match[1].toLowerCase());
  }
  return found;
}

export function validatePlaceholders() {
  const issues = [];
  const allPlaceholders = new Set();
  const strings = collectUserFacingStrings();

  for (const { id, field, text } of strings) {
    if (NESTED_PLACEHOLDER_RE.test(text)) {
      issues.push(`nested placeholder: ${id}.${field}`);
    }
    for (const code of extractPlaceholders(text)) {
      allPlaceholders.add(code);
      if (!RATING_GLOSSARY[code]) {
        issues.push(`unknown placeholder {{${code}}} in ${id}.${field}`);
      }
      if (DOMAIN_CODE_ALIASES[code]) {
        issues.push(`alias used as placeholder {{${code}}} in ${id}.${field}`);
      }
    }

    const stripped = text.replace(PLACEHOLDER_RE, "");
    for (const pattern of BANNED_BARE_ENGLISH) {
      const m = stripped.match(pattern);
      if (m) {
        const word = m[0].toLowerCase();
        if (![...ALLOWED_BARE].some((a) => word.includes(a))) {
          issues.push(`english-only term "${m[0]}" in ${id}.${field}`);
        }
      }
    }
  }

  for (const { id, field, text } of strings) {
    const resolved = resolvePromptText(text);
    if (/\{\{[a-z0-9_]+\}\}/i.test(resolved)) {
      issues.push(`unresolved placeholder after resolve: ${id}.${field}`);
    }
    if (text.includes("\n") && !resolved.includes("\n")) {
      issues.push(`newline lost in resolve: ${id}.${field}`);
    }
  }

  for (const code of allPlaceholders) {
    try {
      formatRatingTerm(code);
    } catch (err) {
      issues.push(`formatRatingTerm failed for ${code}: ${err.message}`);
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    totalPlaceholders: allPlaceholders.size,
    placeholderCodes: [...allPlaceholders].sort(),
    unresolvedCount: issues.filter((i) => i.includes("unresolved")).length,
    englishOnlyCount: issues.filter((i) => i.includes("english-only")).length,
  };
}
