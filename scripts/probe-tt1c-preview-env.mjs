/**
 * Probe Vercel Preview bundle for TT-1C env flags (no secrets logged).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { vercelCurlRequest, getPhase15DeploymentUrl } from "./phase15-vercel-curl-proxy.mjs";
import { resolveStagingPreviewUrl } from "./preview-url-utils.mjs";

function extractJsPaths(html) {
  const paths = new Set();
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)) {
    paths.add(match[1]);
  }
  return [...paths];
}

function detectMode(body) {
  if (/VITE_TEAM_TOURNAMENT_DATA_MODE:`cloud_primary`/.test(body)) return "cloud_primary";
  if (/VITE_TEAM_TOURNAMENT_DATA_MODE:`cloud_only`/.test(body)) return "cloud_only";
  if (/VITE_TEAM_TOURNAMENT_DATA_MODE:`shadow`/.test(body)) return "shadow";
  if (/VITE_TEAM_TOURNAMENT_DATA_MODE:`legacy`/.test(body)) return "legacy";
  if (/VITE_TEAM_TOURNAMENT_SUPABASE:`true`/.test(body)) return "supabase_enabled";
  return "unknown";
}

function redactSecrets(text) {
  return String(text || "")
    .replace(/VITE_SUPABASE_ANON_KEY:`[^`]+`/g, "VITE_SUPABASE_ANON_KEY:`[REDACTED]`")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]");
}

export function probePreviewTeamTournamentEnv(baseUrl) {
  const home = vercelCurlRequest("/", { deployment: baseUrl });
  if (home.status !== 200) {
    return {
      ok: false,
      baseUrl,
      error: home.error || `HTTP ${home.status}`,
      dataMode: null,
    };
  }

  const paths = extractJsPaths(home.body);
  const indexPath = paths.find((p) => /\/assets\/index-[^/]+\.js$/.test(p));
  let importPaths = [];
  if (indexPath) {
    const indexChunk = vercelCurlRequest(indexPath, { deployment: baseUrl });
    if (indexChunk.body) {
      importPaths = [...indexChunk.body.matchAll(/\.\/([^"]+teamTournament[^"]+\.js)/gi)].map(
        (m) => `/assets/${m[1].replace(/^\.\//, "")}`
      );
      const mapHit = indexChunk.body.match(/useTeamTournamentPage-[A-Za-z0-9_-]+\.js/);
      if (mapHit) {
        importPaths.unshift(`/assets/${mapHit[0]}`);
      }
    }
  }

  const priority = paths.filter((p) =>
    /teamTournament|TeamPortal|TeamReferee|useTeamTournament|team-tournament/i.test(p)
  );
  const scanPaths = [...new Set([...importPaths, ...priority, ...paths])].slice(0, 24);

  let combined = redactSecrets(home.body);
  for (const jsPath of scanPaths) {
    const chunk = vercelCurlRequest(jsPath, { deployment: baseUrl });
    if (chunk.body) {
      combined += redactSecrets(chunk.body);
    }
  }

  const dataMode = detectMode(combined);
  const ttSupabaseLikely =
    /VITE_TEAM_TOURNAMENT_SUPABASE:`true`/.test(combined) ||
    combined.includes("team_tournament") ||
    combined.includes("useTeamTournamentPage");

  let commitSha = null;
  const shaMatch = combined.match(/VITE_VERCEL_GIT_COMMIT_SHA:`([a-f0-9]+)`/);
  if (shaMatch) {
    commitSha = shaMatch[1];
  }

  let deploymentId = null;
  const dplMatch = combined.match(/VITE_VERCEL_DEPLOYMENT_ID:`(dpl_[^`]+)`/);
  if (dplMatch) {
    deploymentId = dplMatch[1];
  }

  return {
    ok: true,
    baseUrl,
    dataMode,
    ttSupabaseLikely,
    tt1bGuardsLikely: /VITE_TEAM_TOURNAMENT_TT1B_RPC_GUARDS:`deployed`/.test(combined),
    jsChunksScanned: scanPaths.length,
    commitSha,
    deploymentId,
  };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const resolution = resolveStagingPreviewUrl(getPhase15DeploymentUrl());
  const baseUrl = resolution.ok ? resolution.baseUrl : getPhase15DeploymentUrl();
  console.log(JSON.stringify(probePreviewTeamTournamentEnv(baseUrl), null, 2));
}
