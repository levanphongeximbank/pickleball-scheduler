/**
 * Architecture certification for Experience Channel registry (pure, deterministic).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPERIENCE_CHANNEL_CATEGORY,
  EXPERIENCE_CHANNEL_CLASSIFICATION,
  EXPERIENCE_CHANNEL_FUTURE_SURFACES,
  EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS,
  EXPERIENCE_CHANNEL_SURFACE,
  EXPERIENCE_CHANNEL_VISIBILITY,
} from "../constants/index.js";
import {
  getExperienceChannelRegistryMap,
  listExperienceChannels,
  listRouteOwnership,
} from "../registry/index.js";

const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @typedef {Object} CertificationIssue
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} [details]
 */

/**
 * @returns {{ ok: boolean, issues: CertificationIssue[], channelCount: number }}
 */
export function certifyExperienceChannelRegistry() {
  /** @type {CertificationIssue[]} */
  const issues = [];
  const channels = listExperienceChannels();
  const byId = getExperienceChannelRegistryMap();

  const ids = channels.map((c) => c.channelId);
  if (new Set(ids).size !== ids.length) {
    issues.push({
      code: "DUPLICATE_CHANNEL_ID",
      message: "Channel IDs must be unique",
      details: { ids },
    });
  }

  for (const channel of channels) {
    if (!byId[channel.channelId]) {
      issues.push({
        code: "REGISTRY_MAP_MISMATCH",
        message: `Map missing channel ${channel.channelId}`,
      });
    }
  }

  const routeNamespaces = listRouteOwnership().map((r) => r.routeNamespace);
  const routeSet = new Set();
  for (const ns of routeNamespaces) {
    if (routeSet.has(ns)) {
      issues.push({
        code: "ROUTE_OWNERSHIP_CONFLICT",
        message: `Duplicate route namespace ownership: ${ns}`,
      });
    }
    routeSet.add(ns);
  }

  for (const channel of channels) {
    // Public category must remain PUBLIC visibility (not tenant-private).
    if (
      channel.category === EXPERIENCE_CHANNEL_CATEGORY.PUBLIC &&
      channel.visibility !== EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC
    ) {
      issues.push({
        code: "PUBLIC_TENANT_CONFLICT",
        message: `Public category channel ${channel.channelId} must use PUBLIC visibility`,
        details: { visibility: channel.visibility },
      });
    }

    if (
      channel.category === EXPERIENCE_CHANNEL_CATEGORY.PLATFORM_ADMIN &&
      channel.visibility === EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC
    ) {
      issues.push({
        code: "ADMIN_PUBLIC_CONFLICT",
        message: `Platform-admin channel ${channel.channelId} must not be marked PUBLIC`,
      });
    }

    // Competition E2E owned / competition category must never claim SAFE_CHANNEL_FOUNDATION.
    if (
      (channel.collisionClassification ===
        EXPERIENCE_CHANNEL_CLASSIFICATION.COMPETITION_E2E_OWNED ||
        channel.category === EXPERIENCE_CHANNEL_CATEGORY.COMPETITION_ENGINE) &&
      channel.collisionClassification ===
        EXPERIENCE_CHANNEL_CLASSIFICATION.SAFE_CHANNEL_FOUNDATION
    ) {
      issues.push({
        code: "COMPETITION_SAFE_CONFLICT",
        message: `Competition-owned channel ${channel.channelId} must not be SAFE_CHANNEL_FOUNDATION`,
      });
    }

    if (
      (channel.collisionClassification === EXPERIENCE_CHANNEL_CLASSIFICATION.DEFERRED ||
        channel.implementationStatus ===
          EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.DEFERRED) &&
      !String(channel.deferReason || "").trim()
    ) {
      issues.push({
        code: "MISSING_DEFER_REASON",
        message: `Deferred channel ${channel.channelId} missing deferReason`,
      });
    }

    const onlyFuture = channel.supportedSurfaces.every((s) =>
      EXPERIENCE_CHANNEL_FUTURE_SURFACES.includes(s)
    );
    if (onlyFuture) {
      issues.push({
        code: "FUTURE_SURFACE_ONLY",
        message: `Channel ${channel.channelId} lists only future surfaces; native is not an active implementation`,
      });
    }

    const claimsNativeActive = channel.supportedSurfaces.includes(
      EXPERIENCE_CHANNEL_SURFACE.IOS_FUTURE
    ) || channel.supportedSurfaces.includes(EXPERIENCE_CHANNEL_SURFACE.ANDROID_FUTURE);
    if (
      claimsNativeActive &&
      channel.implementationStatus === EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.ACTIVE &&
      channel.notes.toLowerCase().includes("native store release complete")
    ) {
      issues.push({
        code: "NATIVE_CLAIM_INVALID",
        message: `Channel ${channel.channelId} must not claim native store release complete`,
      });
    }

    for (const [key, value] of Object.entries(channel)) {
      if (typeof value === "function") {
        issues.push({
          code: "EXECUTABLE_LOGIC",
          message: `Descriptor ${channel.channelId} field ${key} is a function`,
        });
      }
    }
  }

  const forbiddenImportPatterns = [
    /from\s+["'][^"']*\/pages\//,
    /from\s+["'][^"']*router\.jsx["']/,
    /from\s+["'][^"']*MainLayout/,
    /from\s+["']react-router-dom["']/,
    /from\s+["']@mui\//,
    /from\s+["']react["']/,
    /from\s+["']react-dom["']/,
  ];

  for (const filePath of collectJsFiles(MODULE_ROOT)) {
    const rel = path.relative(MODULE_ROOT, filePath).replace(/\\/g, "/");
    if (rel.startsWith("validation/")) continue;
    const content = readFileSync(filePath, "utf8");
    for (const pattern of forbiddenImportPatterns) {
      if (pattern.test(content)) {
        issues.push({
          code: "FORBIDDEN_RUNTIME_IMPORT",
          message: `Foundation source imports runtime dependency: ${rel}`,
          details: { pattern: String(pattern) },
        });
      }
    }
  }

  const first = JSON.stringify(listExperienceChannels());
  const second = JSON.stringify(listExperienceChannels());
  if (first !== second) {
    issues.push({
      code: "NON_DETERMINISTIC_REGISTRY",
      message: "listExperienceChannels() is not deterministic",
    });
  }

  return {
    ok: issues.length === 0,
    issues,
    channelCount: channels.length,
  };
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function collectJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectJsFiles(full));
    } else if (/\.(js|mjs|cjs)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}
