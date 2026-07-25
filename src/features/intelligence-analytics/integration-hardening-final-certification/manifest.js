/**
 * Final certification manifest (I&A-13). Immutable.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import {
  CERTIFICATION_MANIFEST_VERSION,
  CERTIFICATION_VERSION,
  INTEGRATION_DEFERRED_SURFACES,
} from "./enums.js";
import {
  CANONICAL_CERTIFIED_SURFACES,
  validateCertifiedSurfaceRegistry,
} from "./surfaces.js";
import { CANONICAL_CERTIFICATION_DIMENSIONS } from "./dimensions.js";
import { createSafeCertificationFingerprint } from "./fingerprint.js";

const REQUIRED_TEST_FILES = Object.freeze(
  CANONICAL_CERTIFIED_SURFACES.map((s) => s.testFile).filter(Boolean)
);

const REQUIRED_DOCS = Object.freeze(
  CANONICAL_CERTIFIED_SURFACES.map((s) => s.docsPath).filter(Boolean)
);

const PROHIBITED_DEPENDENCIES = Object.freeze([
  "platform-core-private",
  "database-client-sdk",
  "external-ai-provider-sdk",
  "external-http-client",
  "browser-storage-fallback",
]);

const REQUIRED_GATES = Object.freeze([
  "node --test tests/intelligence-analytics-ia-13-integration-hardening-final-certification.test.js",
  "node --test tests/intelligence-analytics-ia-01-foundation.test.js",
  "npm run test:unit",
  "npm run lint:no-new",
  "npm run ci:foundation-lock",
  "npm run build",
]);

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceAnalyticsCertificationManifest(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_MANIFEST_INVALID,
        "CertificationManifest must be a plain object",
        "manifest"
      )
    );
  }

  if (!isNonEmptyString(input.manifestId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_MANIFEST_INVALID,
        "manifestId is required",
        "manifest.manifestId",
        { reasonCode: "MANIFEST_INVALID" }
      )
    );
  }

  if (!isNonEmptyString(input.manifestVersion)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_MANIFEST_INVALID,
        "manifestVersion is required",
        "manifest.manifestVersion",
        { reasonCode: "MANIFEST_INVALID" }
      )
    );
  }

  if (!isValidIsoTimestamp(input.generatedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_MANIFEST_INVALID,
        "generatedAt must be a valid ISO timestamp",
        "manifest.generatedAt"
      )
    );
  }

  const surfacesInput = Array.isArray(input.surfaces)
    ? input.surfaces
    : CANONICAL_CERTIFIED_SURFACES;
  const surfacesResult = validateCertifiedSurfaceRegistry(surfacesInput);
  if (!surfacesResult.ok) return surfacesResult;

  const surfaceIds = surfacesResult.value.map((s) => s.surfaceId);
  for (let i = 1; i <= 12; i += 1) {
    const id = `I&A-${String(i).padStart(2, "0")}`;
    if (!surfaceIds.includes(id)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTEGRATION_WORKSTREAM_MISSING,
          `Required surface ${id} missing from manifest`,
          "manifest.surfaces",
          { surfaceId: id, reasonCode: "SURFACE_MISSING" }
        )
      );
    }
  }

  const dimensions = Array.isArray(input.dimensions)
    ? input.dimensions
    : CANONICAL_CERTIFICATION_DIMENSIONS;

  const expectedPublicExports = Object.freeze(
    Array.isArray(input.expectedPublicExports)
      ? input.expectedPublicExports
          .filter(isNonEmptyString)
          .map((e) => String(e).trim())
      : []
  );

  const expectedTestFiles = Object.freeze(
    Array.isArray(input.expectedTestFiles)
      ? input.expectedTestFiles
          .filter(isNonEmptyString)
          .map((e) => String(e).trim())
      : [...REQUIRED_TEST_FILES]
  );

  const expectedDocs = Object.freeze(
    Array.isArray(input.expectedDocs)
      ? input.expectedDocs.filter(isNonEmptyString).map((e) => String(e).trim())
      : [...REQUIRED_DOCS]
  );

  const manifest = deepFreeze({
    manifestId: String(input.manifestId).trim(),
    manifestVersion: String(input.manifestVersion).trim(),
    certificationVersion: isNonEmptyString(input.certificationVersion)
      ? String(input.certificationVersion).trim()
      : CERTIFICATION_VERSION,
    surfaces: surfacesResult.value,
    dimensions: Object.freeze(dimensions.map((d) => deepFreeze({ ...d }))),
    expectedPublicExports,
    expectedTestFiles,
    expectedDocs,
    expectedRegistryEntries: Object.freeze(
      Array.isArray(input.expectedRegistryEntries)
        ? input.expectedRegistryEntries
            .filter(isNonEmptyString)
            .map((e) => String(e).trim())
        : [...expectedTestFiles]
    ),
    requiredDependencies: Object.freeze(
      Array.isArray(input.requiredDependencies)
        ? input.requiredDependencies
            .filter(isNonEmptyString)
            .map((e) => String(e).trim())
        : ["src/features/intelligence-analytics/"]
    ),
    prohibitedDependencies: Object.freeze(
      Array.isArray(input.prohibitedDependencies)
        ? input.prohibitedDependencies
            .filter(isNonEmptyString)
            .map((e) => String(e).trim())
        : [...PROHIBITED_DEPENDENCIES]
    ),
    privacySecurityConstraints: Object.freeze(
      isPlainObject(input.privacySecurityConstraints)
        ? {
            denyDiffersEmpty: true,
            suppressDiffersZero: true,
            redactDiffersMissing: true,
            omitDiffersRedact: true,
            failClosedUnknownClassification: true,
            noPiiInEvidence: true,
            ...input.privacySecurityConstraints,
          }
        : {
            denyDiffersEmpty: true,
            suppressDiffersZero: true,
            redactDiffersMissing: true,
            omitDiffersRedact: true,
            failClosedUnknownClassification: true,
            noPiiInEvidence: true,
          }
    ),
    requiredGates: Object.freeze(
      Array.isArray(input.requiredGates)
        ? input.requiredGates.filter(isNonEmptyString).map((e) => String(e).trim())
        : [...REQUIRED_GATES]
    ),
    deferredSurfaces: Object.freeze(
      Array.isArray(input.deferredSurfaces)
        ? input.deferredSurfaces
            .filter(isNonEmptyString)
            .map((e) => String(e).trim())
        : [...INTEGRATION_DEFERRED_SURFACES]
    ),
    sourceCommit: isNonEmptyString(input.sourceCommit)
      ? String(input.sourceCommit).trim()
      : "UNKNOWN",
    generatedAt: String(input.generatedAt).trim(),
    isProductionReadyClaim: false,
    isCanonicalBusinessState: false,
    provenance: Object.freeze({
      workstreamId: "I&A-13",
      source: "integration-hardening-final-certification",
      isCertificationOnly: true,
      ...(isPlainObject(input.provenance) ? input.provenance : {}),
    }),
  });

  return ok(manifest);
}

/**
 * Build the default immutable certification manifest.
 * @param {unknown} [overrides]
 * @returns {import("../contracts/result.js").Result}
 */
export function buildDefaultIntelligenceAnalyticsCertificationManifest(
  overrides = {}
) {
  const input = isPlainObject(overrides) ? overrides : {};
  return createIntelligenceAnalyticsCertificationManifest({
    manifestId: "ia-13-final-certification",
    manifestVersion: CERTIFICATION_MANIFEST_VERSION,
    certificationVersion: CERTIFICATION_VERSION,
    generatedAt: isNonEmptyString(input.generatedAt)
      ? input.generatedAt
      : "2026-07-25T00:00:00.000Z",
    sourceCommit: input.sourceCommit,
    surfaces: CANONICAL_CERTIFIED_SURFACES,
    dimensions: CANONICAL_CERTIFICATION_DIMENSIONS,
    expectedPublicExports: input.expectedPublicExports,
    expectedTestFiles: REQUIRED_TEST_FILES,
    expectedDocs: REQUIRED_DOCS,
    ...input,
  });
}

/**
 * Structural fingerprint excluding generatedAt.
 * @param {Readonly<Record<string, unknown>>} manifest
 * @returns {string}
 */
export function fingerprintCertificationManifest(manifest) {
  const rest = { ...manifest };
  delete rest.generatedAt;
  return createSafeCertificationFingerprint(rest);
}
