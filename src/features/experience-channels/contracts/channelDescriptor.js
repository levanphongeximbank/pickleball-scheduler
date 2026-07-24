import {
  isExperienceChannelCategory,
  isExperienceChannelClassification,
  isExperienceChannelId,
  isExperienceChannelImplementationStatus,
  isExperienceChannelReadiness,
  isExperienceChannelSurface,
  isExperienceChannelVisibility,
  isExperienceProviderDependency,
  EXPERIENCE_CHANNEL_CLASSIFICATION,
  EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS,
} from "../constants/index.js";
import { deepFreeze, failContract, isNonEmptyString, isPlainObject } from "./shared.js";

/**
 * @typedef {Object} ExperienceChannelDescriptorInput
 * @property {string} channelId
 * @property {string} name
 * @property {string} category
 * @property {string} intendedAudience
 * @property {string} visibility
 * @property {readonly string[]} supportedSurfaces
 * @property {string} routeNamespace
 * @property {string} shellOwner
 * @property {string} providerDependency
 * @property {string} readiness
 * @property {string} implementationStatus
 * @property {string} collisionClassification
 * @property {string} ownerModule
 * @property {string} [notes]
 * @property {string} [deferReason]
 */

/**
 * @param {ExperienceChannelDescriptorInput} input
 * @returns {Readonly<ExperienceChannelDescriptorInput>}
 */
export function createExperienceChannelDescriptor(input) {
  if (!isPlainObject(input)) {
    failContract("INVALID_DESCRIPTOR", "Channel descriptor must be a plain object");
  }

  const channelId = String(input.channelId ?? "").trim();
  const name = String(input.name ?? "").trim();
  const category = String(input.category ?? "").trim();
  const intendedAudience = String(input.intendedAudience ?? "").trim();
  const visibility = String(input.visibility ?? "").trim();
  const routeNamespace = String(input.routeNamespace ?? "").trim();
  const shellOwner = String(input.shellOwner ?? "").trim();
  const providerDependency = String(input.providerDependency ?? "").trim();
  const readiness = String(input.readiness ?? "").trim();
  const implementationStatus = String(input.implementationStatus ?? "").trim();
  const collisionClassification = String(input.collisionClassification ?? "").trim();
  const ownerModule = String(input.ownerModule ?? "").trim();
  const notes = input.notes == null ? "" : String(input.notes).trim();
  const deferReason = input.deferReason == null ? "" : String(input.deferReason).trim();

  if (!isExperienceChannelId(channelId)) {
    failContract("INVALID_CHANNEL_ID", `Unknown channelId: ${channelId}`, { channelId });
  }
  if (!isNonEmptyString(name)) {
    failContract("INVALID_NAME", "Channel name is required", { channelId });
  }
  if (!isExperienceChannelCategory(category)) {
    failContract("INVALID_CATEGORY", `Invalid category: ${category}`, { channelId, category });
  }
  if (!isNonEmptyString(intendedAudience)) {
    failContract("INVALID_AUDIENCE", "intendedAudience is required", { channelId });
  }
  if (!isExperienceChannelVisibility(visibility)) {
    failContract("INVALID_VISIBILITY", `Invalid visibility: ${visibility}`, {
      channelId,
      visibility,
    });
  }
  if (!Array.isArray(input.supportedSurfaces) || input.supportedSurfaces.length === 0) {
    failContract("INVALID_SURFACES", "supportedSurfaces must be a non-empty array", {
      channelId,
    });
  }
  for (const surface of input.supportedSurfaces) {
    if (!isExperienceChannelSurface(surface)) {
      failContract("INVALID_SURFACE", `Invalid surface: ${surface}`, { channelId, surface });
    }
  }
  if (!isNonEmptyString(routeNamespace)) {
    failContract("INVALID_ROUTE_NAMESPACE", "routeNamespace is required", { channelId });
  }
  if (!isNonEmptyString(shellOwner)) {
    failContract("INVALID_SHELL_OWNER", "shellOwner is required", { channelId });
  }
  if (!isExperienceProviderDependency(providerDependency)) {
    failContract("INVALID_PROVIDER_DEPENDENCY", `Invalid providerDependency: ${providerDependency}`, {
      channelId,
      providerDependency,
    });
  }
  if (!isExperienceChannelReadiness(readiness)) {
    failContract("INVALID_READINESS", `Invalid readiness: ${readiness}`, { channelId, readiness });
  }
  if (!isExperienceChannelImplementationStatus(implementationStatus)) {
    failContract(
      "INVALID_IMPLEMENTATION_STATUS",
      `Invalid implementationStatus: ${implementationStatus}`,
      { channelId, implementationStatus }
    );
  }
  if (!isExperienceChannelClassification(collisionClassification)) {
    failContract(
      "INVALID_COLLISION_CLASSIFICATION",
      `Invalid collisionClassification: ${collisionClassification}`,
      { channelId, collisionClassification }
    );
  }
  if (!isNonEmptyString(ownerModule)) {
    failContract("INVALID_OWNER_MODULE", "ownerModule is required", { channelId });
  }

  if (
    collisionClassification === EXPERIENCE_CHANNEL_CLASSIFICATION.COMPETITION_E2E_OWNED &&
    implementationStatus !== EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.OWNED_ELSEWHERE &&
    implementationStatus !== EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.DEFERRED
  ) {
    failContract(
      "COMPETITION_STATUS_CONFLICT",
      "Competition E2E-owned channels must be OWNED_ELSEWHERE or DEFERRED",
      { channelId, implementationStatus }
    );
  }

  if (
    collisionClassification === EXPERIENCE_CHANNEL_CLASSIFICATION.COMPETITION_E2E_OWNED &&
    collisionClassification === EXPERIENCE_CHANNEL_CLASSIFICATION.SAFE_CHANNEL_FOUNDATION
  ) {
    failContract(
      "COMPETITION_SAFE_CONFLICT",
      "Competition E2E-owned surfaces cannot be SAFE_CHANNEL_FOUNDATION",
      { channelId }
    );
  }

  const isDeferred =
    collisionClassification === EXPERIENCE_CHANNEL_CLASSIFICATION.DEFERRED ||
    implementationStatus === EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.DEFERRED;

  if (isDeferred && !isNonEmptyString(deferReason)) {
    failContract("MISSING_DEFER_REASON", "Deferred entries require deferReason", { channelId });
  }

  return deepFreeze({
    channelId,
    name,
    category,
    intendedAudience,
    visibility,
    supportedSurfaces: Object.freeze([...input.supportedSurfaces]),
    routeNamespace,
    shellOwner,
    providerDependency,
    readiness,
    implementationStatus,
    collisionClassification,
    ownerModule,
    notes,
    deferReason,
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isExperienceChannelDescriptor(value) {
  if (!isPlainObject(value)) return false;
  try {
    createExperienceChannelDescriptor(/** @type {any} */ (value));
    return true;
  } catch {
    return false;
  }
}
