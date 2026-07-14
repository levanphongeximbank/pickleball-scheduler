/** Production Wave A (P1-C) — pilot club constants. */
export const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
export const STAGING_REF = "qyewbxjsiiyufanzcjcq";
export const PILOT_CLUB_ID = "club-219e4a7cbd73437eb6271f02a53314c3";
export const PILOT_TENANT_ID = "venue-prod-main";
export const WAVE_A_COHORT_LABEL = "club-rating-v5-production-wave-a";
export const CANDIDATE_INPUT_CSV = "docs/v5/rating-v5/V5-P1C_WAVE_A_CANDIDATE_INPUT.csv";
export const ALLOWED_SKILL_BANDS = new Set(["1.5-2.5", "3.0-3.5", "4.0-4.5"]);

export const BLOCKED_EMAIL_SUFFIXES = [
  "@staging.local",
  "@pickleball-scheduler.qa",
];

export function buildPlayerIdForAuthUser(userId) {
  const safe = String(userId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return `player-auth-${safe}`;
}

export function isBlockedEmail(email) {
  const lower = String(email || "").trim().toLowerCase();
  return BLOCKED_EMAIL_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

export function parseCandidateCsv(content) {
  const lines = content.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    /** @type {Record<string, string>} */
    const row = {};
    headers.forEach((h, i) => {
      row[h] = String(cols[i] ?? "").trim();
    });
    return row;
  });
}
