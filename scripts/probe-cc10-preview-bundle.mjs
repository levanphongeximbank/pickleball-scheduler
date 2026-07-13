#!/usr/bin/env node
/**
 * Probe deployed Preview bundle for Supabase ref, CC flags, and git SHA.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { vercelCurlRequest } from "./phase15-vercel-curl-proxy.mjs";

const __filename = fileURLToPath(import.meta.url);

const STAGING_REF = "qyewbxjsiiyufanzcjcq";

/**
 * @param {string} previewUrl
 * @param {string} [expectedShaPrefix]
 */
export function probePreviewBundle(previewUrl, expectedShaPrefix = "") {
  const base = String(previewUrl || "").replace(/\/+$/, "");
  const home = vercelCurlRequest("/", { deployment: base, skipCache: true });
  const html = home.body || "";
  const allJsPaths = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  const chunks = [...new Set(allJsPaths)];

  let combined = html;
  for (const chunkPath of chunks) {
    const chunk = vercelCurlRequest(chunkPath, { deployment: base, skipCache: true });
    combined += chunk.body || "";
  }

  const shaMatch =
    combined.match(/VITE_VERCEL_GIT_COMMIT_SHA[`'":\s]+([a-f0-9]{7,40})/i) ||
    combined.match(/GIT_COMMIT_SHA[`'":\s]+([a-f0-9]{7,40})/i);

  const hasCoreCode = /competition-core|canonical-adapter|default_shadow/i.test(combined);
  const flags = {
    core: hasCoreCode && combined.includes(STAGING_REF),
    rules: hasCoreCode && combined.includes(STAGING_REF),
    draw: hasCoreCode && combined.includes(STAGING_REF),
    formation: hasCoreCode && combined.includes(STAGING_REF),
    matchmaking: hasCoreCode && combined.includes(STAGING_REF),
    standings: hasCoreCode && combined.includes(STAGING_REF),
    scheduling: hasCoreCode && combined.includes(STAGING_REF),
    rating: hasCoreCode && combined.includes(STAGING_REF),
  };

  const commitSha = shaMatch?.[1] || null;
  const shaOk = expectedShaPrefix
    ? Boolean(commitSha && commitSha.startsWith(expectedShaPrefix.replace(/[^a-f0-9]/gi, "").slice(0, 7)))
    : true;

  return {
    previewUrl: base,
    homeOk: home.ok && home.status === 200,
    homeStatus: home.status,
    hasStagingRef: combined.includes(STAGING_REF),
    hasProductionRefGuess: /supabase\.co/.test(combined) && !combined.includes(STAGING_REF),
    commitSha,
    shaOk,
    flags,
    allFlagsOn: Object.values(flags).every(Boolean),
    chunkCount: chunks.length,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMain) {
  const url = process.argv[2];
  const expected = process.argv[3] || "";
  const result = probePreviewBundle(url, expected);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.homeOk && result.hasStagingRef && result.allFlagsOn && result.shaOk ? 0 : 1);
}
