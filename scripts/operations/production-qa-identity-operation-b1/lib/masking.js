/**
 * Masking helpers — never print full emails or full UUIDs in normal output.
 */

export function maskEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!value.includes("@")) return "[invalid-email]";
  const at = value.lastIndexOf("@");
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const localMask =
    local.length <= 2 ? "**" : `${local.slice(0, 2)}***${local.slice(-1)}`;
  return `${localMask}@${domain}`;
}

export function maskId(id) {
  const value = String(id || "").trim();
  if (value.length < 8) return "[id]";
  return `${value.slice(0, 8)}…`;
}

export function summarizeIdentity(row = {}) {
  return {
    label: row.label || null,
    auth_user_id: maskId(row.auth_user_id),
    profile_id: maskId(row.profile_id),
    email: maskEmail(row.expected_email || row.email),
  };
}
