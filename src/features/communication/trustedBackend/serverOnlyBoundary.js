/**
 * Explicit server-only boundary helpers for ACT-05 tests / ownership proofs.
 * Does not read secrets. Does not import api/ host modules.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMMUNICATION_SERVER_ONLY_BOUNDARY } from "./constants.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FEATURE_ROOT = path.resolve(HERE, "..");
const REPO_ROOT = path.resolve(FEATURE_ROOT, "../../..");

/**
 * Relative paths that may hold privileged client usage when injected —
 * still must never embed SERVICE_ROLE_KEY literals or VITE_* service keys.
 */
export function listCommunicationServerOnlyModulePaths() {
  return Object.freeze([
    "api/communication/authorizeCommunicationActor.js",
    "api/communication/authorizeSystemProducer.js",
    "api/communication/command.js",
    "api/communication/system-produce.js",
    "src/features/communication/trustedBackend/createTrustedCommunicationBackend.js",
    "src/features/communication/trustedBackend/createSystemMessageProducer.js",
    "src/features/communication/adapters/createSupabaseClubMembershipReader.js",
  ]);
}

/**
 * Scan Communication browser/runtime surfaces for service-role leakage.
 * @param {{ repoRoot?: string }} [options]
 */
export function assertNoServiceRoleInCommunicationBrowserSurface(options = {}) {
  const repoRoot = options.repoRoot || REPO_ROOT;
  const scanRoots = [
    path.join(repoRoot, "src/features/communication/experience"),
    path.join(repoRoot, "src/features/communication/runtime"),
    path.join(
      repoRoot,
      "src/features/communication/trustedBackend/createTrustedBackendHttpMessagingGateway.js"
    ),
  ];

  const leak =
    /SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|sb_secret_|VITE_.*SERVICE_ROLE/i;
  /** @type {string[]} */
  const findings = [];

  function walk(filePath) {
    const st = fs.statSync(filePath);
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(filePath)) {
        if (name === "node_modules") continue;
        walk(path.join(filePath, name));
      }
      return;
    }
    if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) return;
    const text = fs.readFileSync(filePath, "utf8");
    if (leak.test(text)) {
      findings.push(path.relative(repoRoot, filePath).replace(/\\/g, "/"));
    }
  }

  for (const root of scanRoots) {
    if (fs.existsSync(root)) walk(root);
  }

  return Object.freeze({
    ok: findings.length === 0,
    boundary: COMMUNICATION_SERVER_ONLY_BOUNDARY,
    findings,
  });
}
