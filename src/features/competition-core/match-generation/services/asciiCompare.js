/**
 * CORE-09 — ASCII lexicographic compare (no locale-dependent collation).
 */

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number}
 */
export function asciiCompare(a, b) {
  const left = String(a);
  const right = String(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * @param {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} issues
 * @returns {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]}
 */
export function sortMatchGenerationIssues(issues) {
  return [...(issues || [])].sort((a, b) => {
    const c = asciiCompare(a.code, b.code);
    if (c !== 0) return c;
    const p = asciiCompare(a.path, b.path);
    if (p !== 0) return p;
    return asciiCompare(a.message, b.message);
  });
}
