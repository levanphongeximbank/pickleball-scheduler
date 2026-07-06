export function buildCaptainPortalUrl(tournamentId) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/team-portal/${tournamentId}`;
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
