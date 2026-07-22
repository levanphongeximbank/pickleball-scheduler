/**
 * CORE-14 — frozen pipe-grammar escaping.
 * \ → \\ | → \| = → \=
 * Identity strings are not trimmed / lower-cased / Unicode-normalized.
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
export function escapeCore14Token(value) {
  const s = String(value);
  let out = "";
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === "\\") out += "\\\\";
    else if (ch === "|") out += "\\|";
    else if (ch === "=") out += "\\=";
    else out += ch;
  }
  return out;
}
