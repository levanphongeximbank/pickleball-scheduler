export function buildCaptainPortalPath(tournamentId, options = {}) {
  const id = String(tournamentId || "").trim();
  const base = `/team-portal/${id}`;
  const clubId = String(options?.clubId || "").trim();
  if (!clubId) {
    return base;
  }
  return `${base}?club=${encodeURIComponent(clubId)}`;
}

export function buildCaptainPortalUrl(tournamentId, options = {}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${buildCaptainPortalPath(tournamentId, options)}`;
}

export function buildRefereePortalUrl(tournamentId, matchupId) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const base = `${origin}/team-referee/${tournamentId}`;
  return matchupId ? `${base}?matchup=${encodeURIComponent(matchupId)}` : base;
}

export async function copyTextToClipboard(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  return ok;
}
