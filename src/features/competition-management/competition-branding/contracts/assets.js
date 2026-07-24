/**
 * Brand asset reference validation (CM-05).
 * Metadata/reference only — no binary, no network, no upload.
 */

import {
  COMPETITION_BRAND_ASSET_KIND,
  COMPETITION_BRAND_ASSET_KINDS_REQUIRING_ALT,
  COMPETITION_BRAND_ASSET_ACCESS,
  isCompetitionBrandAssetKind,
  isCompetitionBrandAssetAccess,
} from "../constants/assetKinds.js";
import { COMPETITION_BRAND_ALT_TEXT_MAX_LENGTH } from "../constants/presentation.js";
import { COMPETITION_BRANDING_ERROR_CODE } from "../errors/errorCodes.js";
import { createFieldError } from "./validation.js";
import {
  deepFreeze,
  isNonEmptyString,
  hasControlCharacters,
  compareFieldPath,
} from "./shared.js";

const SAFE_PROTOCOLS = Object.freeze(["https:", "http:"]);
const UNSAFE_PROTOCOL_RE = /^(javascript|data|file|vbscript|blob):/i;
const LOCAL_PATH_RE = /^(?:[a-zA-Z]:[\\/]|\\\\|\/(?!\/)|~\/)/;
const SENSITIVE_QUERY_RE =
  /(?:^|[?&])(token|signature|sig|X-Amz-Signature|X-Amz-Credential|access_token|auth|key|secret)=/i;
const ASSET_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/;
const OBJECT_KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9._\-/]{0,255}$/;
const MIME_RE = /^image\/(png|jpeg|jpg|webp|svg\+xml|gif)$/i;

/**
 * Detect signed/tokenized URI noise that must not be canonical identity.
 * @param {string} uri
 * @returns {boolean}
 */
export function isSignedOrTokenizedUri(uri) {
  if (!isNonEmptyString(uri)) return false;
  const s = String(uri);
  if (SENSITIVE_QUERY_RE.test(s)) return true;
  try {
    const u = new URL(s);
    if ([...u.searchParams.keys()].some((k) =>
      /token|signature|sig|credential|secret|auth/i.test(k)
    )) {
      return true;
    }
  } catch {
    // not a parseable absolute URL — handled elsewhere
  }
  return false;
}

/**
 * Validate optional reference URI (not used as primary identity).
 * @param {unknown} uri
 * @param {string} fieldPath
 * @returns {object[]}
 */
export function collectUnsafeUriErrors(uri, fieldPath) {
  /** @type {object[]} */
  const errors = [];
  if (uri == null || uri === "") return errors;
  if (typeof uri !== "string") {
    errors.push(
      createFieldError(
        fieldPath,
        COMPETITION_BRANDING_ERROR_CODE.UNSAFE_ASSET_URI,
        "referenceUri must be a string when provided",
        {}
      )
    );
    return errors;
  }
  const raw = uri.trim();
  if (UNSAFE_PROTOCOL_RE.test(raw)) {
    errors.push(
      createFieldError(
        fieldPath,
        COMPETITION_BRANDING_ERROR_CODE.UNSAFE_ASSET_URI,
        "javascript:, data:, file:, blob:, and similar protocols are rejected",
        { value: raw.slice(0, 64) }
      )
    );
    return errors;
  }
  if (LOCAL_PATH_RE.test(raw)) {
    errors.push(
      createFieldError(
        fieldPath,
        COMPETITION_BRANDING_ERROR_CODE.UNSAFE_ASSET_URI,
        "local file paths are rejected",
        {}
      )
    );
    return errors;
  }
  if (isSignedOrTokenizedUri(raw)) {
    errors.push(
      createFieldError(
        fieldPath,
        COMPETITION_BRANDING_ERROR_CODE.SIGNED_OR_PRIVATE_ASSET_NOT_PUBLIC_SAFE,
        "signed URL tokens / sensitive query parameters cannot be canonical asset identity",
        {}
      )
    );
    return errors;
  }
  try {
    const u = new URL(raw);
    if (!SAFE_PROTOCOLS.includes(u.protocol)) {
      errors.push(
        createFieldError(
          fieldPath,
          COMPETITION_BRANDING_ERROR_CODE.UNSAFE_ASSET_URI,
          "only http: and https: protocols are allowed for referenceUri",
          { protocol: u.protocol }
        )
      );
    }
    if (u.username || u.password) {
      errors.push(
        createFieldError(
          fieldPath,
          COMPETITION_BRANDING_ERROR_CODE.UNSAFE_ASSET_URI,
          "URI credentials (username/password) are rejected",
          {}
        )
      );
    }
  } catch {
    errors.push(
      createFieldError(
        fieldPath,
        COMPETITION_BRANDING_ERROR_CODE.UNSAFE_ASSET_URI,
        "referenceUri must be an absolute http(s) URL when provided",
        {}
      )
    );
  }
  return errors;
}

/**
 * @param {unknown} asset
 * @param {string} fieldPath
 * @param {{ tenantId: string }} scope
 * @returns {{ errors: object[], value: object | null }}
 */
export function parseBrandAssetReference(asset, fieldPath, scope) {
  /** @type {object[]} */
  const errors = [];

  if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
    errors.push(
      createFieldError(
        fieldPath,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_ASSET_REFERENCE,
        "asset reference must be a plain object",
        {}
      )
    );
    return { errors, value: null };
  }

  const src = /** @type {any} */ (asset);

  if (!isCompetitionBrandAssetKind(src.kind)) {
    errors.push(
      createFieldError(
        `${fieldPath}.kind`,
        COMPETITION_BRANDING_ERROR_CODE.UNSUPPORTED_ASSET_KIND,
        "unsupported or missing asset kind",
        { value: src.kind }
      )
    );
  }

  if (!isNonEmptyString(src.assetId)) {
    errors.push(
      createFieldError(
        `${fieldPath}.assetId`,
        COMPETITION_BRANDING_ERROR_CODE.MISSING_ASSET_IDENTITY,
        "explicit assetId is required (stable reference preferred over remote URL)",
        {}
      )
    );
  } else if (!ASSET_ID_RE.test(String(src.assetId).trim())) {
    errors.push(
      createFieldError(
        `${fieldPath}.assetId`,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_ASSET_REFERENCE,
        "assetId format is invalid",
        {}
      )
    );
  }

  // Ownership: require explicit tenantId matching branding tenant, or ownershipScope=global_safe
  const ownershipScope = isNonEmptyString(src.ownershipScope)
    ? String(src.ownershipScope).trim()
    : "tenant";

  if (ownershipScope === "global_safe") {
    // allowed without tenant match
  } else if (ownershipScope === "tenant") {
    if (!isNonEmptyString(src.tenantId)) {
      errors.push(
        createFieldError(
          `${fieldPath}.tenantId`,
          COMPETITION_BRANDING_ERROR_CODE.ASSET_OWNERSHIP_MISMATCH,
          "explicit asset tenantId is required for tenant-scoped ownership (fail-closed)",
          {}
        )
      );
    } else if (String(src.tenantId).trim() !== scope.tenantId) {
      errors.push(
        createFieldError(
          `${fieldPath}.tenantId`,
          COMPETITION_BRANDING_ERROR_CODE.ASSET_OWNERSHIP_MISMATCH,
          "asset tenantId must match branding tenantId",
          {
            expected: scope.tenantId,
            actual: src.tenantId,
          }
        )
      );
    }
  } else {
    errors.push(
      createFieldError(
        `${fieldPath}.ownershipScope`,
        COMPETITION_BRANDING_ERROR_CODE.ASSET_OWNERSHIP_MISMATCH,
        "ownershipScope must be tenant|global_safe (ownership cannot be ambiguous)",
        { value: ownershipScope }
      )
    );
  }

  const accessClassification = isCompetitionBrandAssetAccess(src.accessClassification)
    ? src.accessClassification
    : COMPETITION_BRAND_ASSET_ACCESS.UNKNOWN;

  if (
    src.accessClassification != null &&
    !isCompetitionBrandAssetAccess(src.accessClassification)
  ) {
    errors.push(
      createFieldError(
        `${fieldPath}.accessClassification`,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_ASSET_REFERENCE,
        "accessClassification must be public|private|unknown",
        { value: src.accessClassification }
      )
    );
  }

  errors.push(...collectUnsafeUriErrors(src.referenceUri, `${fieldPath}.referenceUri`));

  if (src.objectKey != null && src.objectKey !== "") {
    if (
      typeof src.objectKey !== "string" ||
      !OBJECT_KEY_RE.test(src.objectKey.trim())
    ) {
      errors.push(
        createFieldError(
          `${fieldPath}.objectKey`,
          COMPETITION_BRANDING_ERROR_CODE.INVALID_ASSET_REFERENCE,
          "objectKey format is invalid",
          {}
        )
      );
    }
  }

  if (src.mimeType != null && src.mimeType !== "") {
    if (typeof src.mimeType !== "string" || !MIME_RE.test(src.mimeType.trim())) {
      errors.push(
        createFieldError(
          `${fieldPath}.mimeType`,
          COMPETITION_BRANDING_ERROR_CODE.INVALID_ASSET_REFERENCE,
          "mimeType must be an allowed image/* type when provided",
          { value: src.mimeType }
        )
      );
    }
  }

  if (src.width != null || src.height != null) {
    if (
      !Number.isInteger(src.width) ||
      src.width < 1 ||
      !Number.isInteger(src.height) ||
      src.height < 1
    ) {
      errors.push(
        createFieldError(
          `${fieldPath}.dimensions`,
          COMPETITION_BRANDING_ERROR_CODE.INVALID_ASSET_REFERENCE,
          "width/height must both be integers >= 1 when either is provided",
          {}
        )
      );
    }
  }

  if (src.contentHash != null && src.contentHash !== "") {
    if (
      typeof src.contentHash !== "string" ||
      !/^[a-fA-F0-9]{16,128}$/.test(src.contentHash.trim())
    ) {
      errors.push(
        createFieldError(
          `${fieldPath}.contentHash`,
          COMPETITION_BRANDING_ERROR_CODE.INVALID_ASSET_REFERENCE,
          "contentHash must be a hex string when provided",
          {}
        )
      );
    }
  }

  // Reject binary / base64 embedding
  for (const forbidden of ["base64", "binary", "dataUri", "buffer", "bytes"]) {
    if (Object.prototype.hasOwnProperty.call(src, forbidden)) {
      errors.push(
        createFieldError(
          `${fieldPath}.${forbidden}`,
          COMPETITION_BRANDING_ERROR_CODE.INVALID_ASSET_REFERENCE,
          "binary/base64 content must not be embedded in canonical asset reference",
          {}
        )
      );
    }
  }

  const requiresAlt = COMPETITION_BRAND_ASSET_KINDS_REQUIRING_ALT.includes(src.kind);
  if (requiresAlt) {
    if (!isNonEmptyString(src.altText)) {
      errors.push(
        createFieldError(
          `${fieldPath}.altText`,
          COMPETITION_BRANDING_ERROR_CODE.MISSING_ALT_TEXT,
          "alt text is required for this public-facing asset kind",
          { kind: src.kind }
        )
      );
    } else {
      const alt = String(src.altText).trim();
      if (hasControlCharacters(alt)) {
        errors.push(
          createFieldError(
            `${fieldPath}.altText`,
            COMPETITION_BRANDING_ERROR_CODE.INVALID_ASSET_REFERENCE,
            "alt text must not contain control characters",
            {}
          )
        );
      }
      if (alt.length > COMPETITION_BRAND_ALT_TEXT_MAX_LENGTH) {
        errors.push(
          createFieldError(
            `${fieldPath}.altText`,
            COMPETITION_BRANDING_ERROR_CODE.INVALID_ASSET_REFERENCE,
            `alt text exceeds max length ${COMPETITION_BRAND_ALT_TEXT_MAX_LENGTH}`,
            { length: alt.length }
          )
        );
      }
    }
  } else if (src.altText != null && src.altText !== "") {
    if (typeof src.altText !== "string" || hasControlCharacters(String(src.altText))) {
      errors.push(
        createFieldError(
          `${fieldPath}.altText`,
          COMPETITION_BRANDING_ERROR_CODE.INVALID_ASSET_REFERENCE,
          "alt text must be a safe string when provided",
          {}
        )
      );
    }
  }

  if (src.assetRevision != null) {
    if (!Number.isInteger(src.assetRevision) || src.assetRevision < 1) {
      errors.push(
        createFieldError(
          `${fieldPath}.assetRevision`,
          COMPETITION_BRANDING_ERROR_CODE.INVALID_ASSET_REFERENCE,
          "assetRevision must be an integer >= 1 when provided",
          {}
        )
      );
    }
  }

  if (errors.length > 0) return { errors, value: null };

  const value = deepFreeze({
    kind: src.kind,
    assetId: String(src.assetId).trim(),
    tenantId:
      ownershipScope === "tenant" ? String(src.tenantId).trim() : null,
    ownershipScope,
    storageProvider: isNonEmptyString(src.storageProvider)
      ? String(src.storageProvider).trim()
      : null,
    objectKey: isNonEmptyString(src.objectKey)
      ? String(src.objectKey).trim()
      : null,
    referenceUri: isNonEmptyString(src.referenceUri)
      ? String(src.referenceUri).trim()
      : null,
    accessClassification,
    mimeType: isNonEmptyString(src.mimeType)
      ? String(src.mimeType).trim().toLowerCase()
      : null,
    width: Number.isInteger(src.width) ? src.width : null,
    height: Number.isInteger(src.height) ? src.height : null,
    altText: isNonEmptyString(src.altText) ? String(src.altText).trim() : null,
    contentHash: isNonEmptyString(src.contentHash)
      ? String(src.contentHash).trim().toLowerCase()
      : null,
    assetRevision: Number.isInteger(src.assetRevision) ? src.assetRevision : null,
  });

  return { errors: [], value };
}

/**
 * Parse assets array — empty allowed. Deterministic sort by kind then assetId.
 * @param {unknown} assets
 * @param {{ tenantId: string }} scope
 * @returns {{ errors: object[], value: ReadonlyArray<object> }}
 */
export function parseBrandAssets(assets, scope) {
  /** @type {object[]} */
  const errors = [];

  if (assets == null) {
    return { errors: [], value: deepFreeze([]) };
  }

  if (!Array.isArray(assets)) {
    errors.push(
      createFieldError(
        "assets",
        COMPETITION_BRANDING_ERROR_CODE.INVALID_ASSET_REFERENCE,
        "assets must be an array",
        {}
      )
    );
    return { errors, value: deepFreeze([]) };
  }

  /** @type {object[]} */
  const parsed = [];
  /** @type {Set<string>} */
  const kindsSeen = new Set();
  /** @type {Set<string>} */
  const idsSeen = new Set();

  for (let i = 0; i < assets.length; i += 1) {
    const fieldPath = `assets[${i}]`;
    const result = parseBrandAssetReference(assets[i], fieldPath, scope);
    errors.push(...result.errors);
    if (!result.value) continue;

    if (kindsSeen.has(result.value.kind)) {
      errors.push(
        createFieldError(
          `${fieldPath}.kind`,
          COMPETITION_BRANDING_ERROR_CODE.DUPLICATE_ASSET_KIND,
          "duplicate asset kind is not allowed",
          { kind: result.value.kind }
        )
      );
      continue;
    }
    if (idsSeen.has(result.value.assetId)) {
      errors.push(
        createFieldError(
          `${fieldPath}.assetId`,
          COMPETITION_BRANDING_ERROR_CODE.INVALID_ASSET_REFERENCE,
          "duplicate assetId within branding assets",
          { assetId: result.value.assetId }
        )
      );
      continue;
    }
    kindsSeen.add(result.value.kind);
    idsSeen.add(result.value.assetId);
    parsed.push(result.value);
  }

  parsed.sort((a, b) => {
    const byKind = compareFieldPath(a.kind, b.kind);
    if (byKind !== 0) return byKind;
    return compareFieldPath(a.assetId, b.assetId);
  });

  return { errors, value: deepFreeze(parsed) };
}

export { COMPETITION_BRAND_ASSET_KIND };
