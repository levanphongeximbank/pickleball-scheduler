#!/usr/bin/env node
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

loadProjectEnv();
const { url, anonKey, stagingRef } = getStagingSupabaseEnv();
if (!url || !anonKey) throw new Error("Missing Staging URL or anon key");

const allowed = [
  ["news_public_content_query_public", {}],
  ["public_catalog_list_clubs", {}],
  ["public_catalog_list_courts", {}],
  ["public_catalog_list_rankings", {}],
  ["public_catalog_list_tournaments", {}],
  ["referee_get_match_by_token", { p_token: "phase6-invalid-token-readonly" }],
  ["referee_update_match_score", { p_token: "phase6-invalid-token-readonly", p_payload: {} }],
];
const denied = [
  ["club_get_my_active_membership", {}],
  ["identity_list_users", {}],
  ["rating_v5_get_my_pilot_enrollment", {}],
];

async function rpc(name, args) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const body = await response.text();
  const permissionDenied = response.status === 401 || response.status === 403 || /permission denied|42501/i.test(body);
  return { name, status: response.status, permissionDenied, responseBytes: Buffer.byteLength(body) };
}

const allowedResults = [];
for (const [name, args] of allowed) allowedResults.push(await rpc(name, args));
const deniedResults = [];
for (const [name, args] of denied) deniedResults.push(await rpc(name, args));

const failures = [
  ...allowedResults.filter((x) => x.permissionDenied).map((x) => `${x.name}: unexpectedly denied`),
  ...deniedResults.filter((x) => !x.permissionDenied).map((x) => `${x.name}: unexpectedly executable`),
];
const evidence = {
  marker: "PHASE6_STAGING_ANON_RPC_ALLOWLIST_QA_V1",
  capturedAt: new Date().toISOString(),
  stagingRef,
  mode: "ANON_RUNTIME_NO_VALID_MUTATION_TOKEN",
  productionMutation: 0,
  allowedResults,
  deniedResults,
  pass: failures.length === 0,
  failures,
};
console.log(JSON.stringify(evidence, null, 2));
if (!evidence.pass) process.exitCode = 1;
