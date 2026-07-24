/**
 * Deterministic Public Portal readiness certification (EC-01).
 * Pure metadata checks — no ranking/scoring/standings/eligibility logic.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPERIENCE_CHANNEL_CLASSIFICATION,
  EXPERIENCE_CHANNEL_ID,
  EXPERIENCE_CHANNEL_READINESS,
  EXPERIENCE_CHANNEL_VISIBILITY,
} from "../../constants/index.js";
import {
  PUBLIC_PORTAL_COMPETITION_MARKER,
  PUBLIC_PORTAL_DATA_SOURCE,
  PUBLIC_PORTAL_SURFACE_ID_VALUES,
} from "../constants/index.js";
import {
  getPublicPortalSharedReadinessEvidence,
  listPublicPortalBoundaryMarkers,
  listPublicPortalSurfaces,
} from "../registry/index.js";

const PUBLIC_PORTAL_MODULE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

/**
 * @typedef {Object} CertificationIssue
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} [details]
 */

/**
 * @returns {{
 *   ok: boolean,
 *   issues: CertificationIssue[],
 *   surfaceCount: number,
 *   boundaryCount: number,
 *   phase: string
 * }}
 */
export function certifyPublicPortalReadiness() {
  /** @type {CertificationIssue[]} */
  const issues = [];
  const surfaces = listPublicPortalSurfaces();
  const boundaries = listPublicPortalBoundaryMarkers();
  const shared = getPublicPortalSharedReadinessEvidence();

  const ids = surfaces.map((s) => s.surfaceId);
  if (new Set(ids).size !== ids.length) {
    issues.push({
      code: "DUPLICATE_SURFACE_ID",
      message: "Public portal surface IDs must be unique",
      details: { ids },
    });
  }

  for (const expected of PUBLIC_PORTAL_SURFACE_ID_VALUES) {
    if (!ids.includes(expected)) {
      issues.push({
        code: "MISSING_SURFACE_ID",
        message: `Registry missing surfaceId ${expected}`,
      });
    }
  }

  const routes = surfaces.map((s) => s.routePattern);
  if (new Set(routes).size !== routes.length) {
    issues.push({
      code: "DUPLICATE_ROUTE_PATTERN",
      message: "Public portal route patterns must be unique",
      details: { routes },
    });
  }

  for (const surface of surfaces) {
    if (surface.visibility !== EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC) {
      issues.push({
        code: "NON_PUBLIC_VISIBILITY",
        message: `Surface ${surface.surfaceId} must be PUBLIC visibility`,
        details: { visibility: surface.visibility },
      });
    }

    if (surface.ownerChannelId !== EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL) {
      issues.push({
        code: "OWNER_CHANNEL_MISMATCH",
        message: `Surface ${surface.surfaceId} must be owned by public-portal`,
        details: { ownerChannelId: surface.ownerChannelId },
      });
    }

    if (
      (surface.dataSource === PUBLIC_PORTAL_DATA_SOURCE.MOCK ||
        surface.dataSource === PUBLIC_PORTAL_DATA_SOURCE.PREVIEW) &&
      surface.overallReadiness === EXPERIENCE_CHANNEL_READINESS.IMPLEMENTED
    ) {
      issues.push({
        code: "MOCK_PRODUCTION_READY",
        message: `Mock/preview surface ${surface.surfaceId} must not be production-ready`,
      });
    }

    if (
      (surface.dataSource === PUBLIC_PORTAL_DATA_SOURCE.MIXED ||
        surface.dataSource === PUBLIC_PORTAL_DATA_SOURCE.UNKNOWN) &&
      !String(surface.dataSourceNotes || "").trim()
    ) {
      issues.push({
        code: "MIXED_WITHOUT_NOTES",
        message: `Surface ${surface.surfaceId} MIXED/UNKNOWN requires dataSourceNotes`,
      });
    }

    if (
      (surface.competitionOwnershipMarker ===
        PUBLIC_PORTAL_COMPETITION_MARKER.COMPETITION_E2E_OWNED ||
        surface.collisionClassification ===
          EXPERIENCE_CHANNEL_CLASSIFICATION.COMPETITION_E2E_OWNED) &&
      surface.safeForRemediation
    ) {
      issues.push({
        code: "COMPETITION_SAFE_REMEDIATION",
        message: `Competition-owned surface ${surface.surfaceId} must not be safeForRemediation`,
      });
    }

    const deferred =
      surface.collisionClassification === EXPERIENCE_CHANNEL_CLASSIFICATION.DEFERRED ||
      surface.overallReadiness === EXPERIENCE_CHANNEL_READINESS.DEFERRED;
    if (deferred && !String(surface.deferReason || "").trim()) {
      issues.push({
        code: "MISSING_DEFER_REASON",
        message: `Deferred surface ${surface.surfaceId} missing deferReason`,
      });
    }

    if (surface.overallReadiness === EXPERIENCE_CHANNEL_READINESS.IMPLEMENTED) {
      for (const key of [
        "loadingStateReadiness",
        "errorStateReadiness",
        "emptyStateReadiness",
      ]) {
        const value = surface[key];
        if (
          value === EXPERIENCE_CHANNEL_READINESS.MISSING ||
          value === EXPERIENCE_CHANNEL_READINESS.NOT_VERIFIED
        ) {
          issues.push({
            code: "PRODUCTION_STATE_GAP",
            message: `Surface ${surface.surfaceId} IMPLEMENTED but ${key} is ${value}`,
          });
        }
      }
      if (surface.accessibilityState === EXPERIENCE_CHANNEL_READINESS.NOT_VERIFIED) {
        issues.push({
          code: "A11Y_NOT_VERIFIED_CLAIM",
          message: `Surface ${surface.surfaceId} cannot claim IMPLEMENTED with a11y NOT_VERIFIED`,
        });
      }
      if (surface.responsiveState === EXPERIENCE_CHANNEL_READINESS.NOT_VERIFIED) {
        issues.push({
          code: "RESPONSIVE_NOT_VERIFIED_CLAIM",
          message: `Surface ${surface.surfaceId} cannot claim IMPLEMENTED with responsive NOT_VERIFIED`,
        });
      }
    }

    for (const [key, value] of Object.entries(surface)) {
      if (typeof value === "function") {
        issues.push({
          code: "EXECUTABLE_LOGIC",
          message: `Surface ${surface.surfaceId} field ${key} is a function`,
        });
      }
    }
  }

  const boundaryIds = boundaries.map((b) => b.boundaryId);
  if (new Set(boundaryIds).size !== boundaryIds.length) {
    issues.push({
      code: "DUPLICATE_BOUNDARY_ID",
      message: "Boundary marker IDs must be unique",
      details: { boundaryIds },
    });
  }

  for (const boundary of boundaries) {
    if (boundary.safeForRemediation) {
      issues.push({
        code: "BOUNDARY_SAFE_REMEDIATION",
        message: `Boundary ${boundary.boundaryId} must not be safeForRemediation`,
      });
    }
    if (!String(boundary.deferReason || "").trim()) {
      issues.push({
        code: "BOUNDARY_MISSING_DEFER_REASON",
        message: `Boundary ${boundary.boundaryId} missing deferReason`,
      });
    }
    if (boundary.ownerChannelId === EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL) {
      issues.push({
        code: "BOUNDARY_FALSE_PORTAL_OWNERSHIP",
        message: `Boundary ${boundary.boundaryId} must not claim public-portal ownership`,
      });
    }
  }

  // Athletes must not be treated as anonymous public-portal remediation targets.
  const athletes = boundaries.find((b) => b.boundaryId.includes("athletes"));
  if (athletes && athletes.ownerChannelId !== EXPERIENCE_CHANNEL_ID.PLAYER) {
    issues.push({
      code: "ATHLETES_OWNERSHIP_ALIGNMENT",
      message: "Athletes directory boundary must be owned by PLAYER channel",
    });
  }

  if (shared.pwa.nativeStoreRelease !== false) {
    issues.push({
      code: "NATIVE_STORE_CLAIM",
      message: "EC-01 must not claim native iOS/Android store release",
    });
  }
  if (shared.pwa.iosReleasePercent !== 0 || shared.pwa.androidReleasePercent !== 0) {
    issues.push({
      code: "NATIVE_PERCENT_CLAIM",
      message: "iOS/Android release percent must remain 0 in EC-01",
    });
  }

  const forbiddenImportPatterns = [
    /from\s+["'][^"']*\/pages\//,
    /from\s+["'][^"']*router\.jsx["']/,
    /from\s+["'][^"']*MainLayout/,
    /from\s+["'][^"']*PublicLayout/,
    /from\s+["']react-router-dom["']/,
    /from\s+["']@mui\//,
    /from\s+["']react["']/,
    /from\s+["']react-dom["']/,
    /from\s+["'][^"']*competition-engine[^"']*["']/,
    /from\s+["'][^"']*(standings|eligibility|scoringEngine|computeRank)[^"']*["']/i,
  ];

  for (const filePath of collectJsFiles(PUBLIC_PORTAL_MODULE_ROOT)) {
    const rel = path.relative(PUBLIC_PORTAL_MODULE_ROOT, filePath).replace(/\\/g, "/");
    if (rel.startsWith("validation/")) continue;
    const content = readFileSync(filePath, "utf8");
    for (const pattern of forbiddenImportPatterns) {
      if (pattern.test(content)) {
        issues.push({
          code: "FORBIDDEN_RUNTIME_OR_BUSINESS_IMPORT",
          message: `Public-portal certification source has forbidden pattern: ${rel}`,
          details: { pattern: String(pattern) },
        });
      }
    }
  }

  const first = JSON.stringify(listPublicPortalSurfaces());
  const second = JSON.stringify(listPublicPortalSurfaces());
  if (first !== second) {
    issues.push({
      code: "NON_DETERMINISTIC_REGISTRY",
      message: "listPublicPortalSurfaces() is not deterministic",
    });
  }

  return {
    ok: issues.length === 0,
    issues,
    surfaceCount: surfaces.length,
    boundaryCount: boundaries.length,
    phase: "EC-01",
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
