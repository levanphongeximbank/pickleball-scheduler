import {
  isExperienceChannelClassification,
  isExperienceChannelId,
  isExperienceProviderDependency,
} from "../constants/index.js";
import { deepFreeze, failContract, isNonEmptyString, isPlainObject } from "./shared.js";

/**
 * @typedef {Object} RouteOwnershipDescriptorInput
 * @property {string} routeNamespace
 * @property {string} ownerChannelId
 * @property {string} collisionClassification
 * @property {string} [notes]
 */

/**
 * @typedef {Object} ShellOwnershipDescriptorInput
 * @property {string} shellId
 * @property {string} ownerChannelId
 * @property {string} collisionClassification
 * @property {readonly string[]} pathHints
 * @property {string} [notes]
 */

/**
 * @typedef {Object} ProviderOwnershipDescriptorInput
 * @property {string} providerId
 * @property {string} dependency
 * @property {string} collisionClassification
 * @property {readonly string[]} pathHints
 * @property {string} [notes]
 */

/**
 * @param {RouteOwnershipDescriptorInput} input
 * @returns {Readonly<RouteOwnershipDescriptorInput>}
 */
export function createRouteOwnershipDescriptor(input) {
  if (!isPlainObject(input)) {
    failContract("INVALID_ROUTE_OWNERSHIP", "Route ownership must be a plain object");
  }
  const routeNamespace = String(input.routeNamespace ?? "").trim();
  const ownerChannelId = String(input.ownerChannelId ?? "").trim();
  const collisionClassification = String(input.collisionClassification ?? "").trim();
  const notes = input.notes == null ? "" : String(input.notes).trim();

  if (!isNonEmptyString(routeNamespace)) {
    failContract("INVALID_ROUTE_NAMESPACE", "routeNamespace is required");
  }
  if (!isExperienceChannelId(ownerChannelId)) {
    failContract("INVALID_OWNER_CHANNEL", `Unknown ownerChannelId: ${ownerChannelId}`, {
      ownerChannelId,
    });
  }
  if (!isExperienceChannelClassification(collisionClassification)) {
    failContract("INVALID_COLLISION_CLASSIFICATION", `Invalid classification: ${collisionClassification}`);
  }

  return deepFreeze({
    routeNamespace,
    ownerChannelId,
    collisionClassification,
    notes,
  });
}

/**
 * @param {ShellOwnershipDescriptorInput} input
 * @returns {Readonly<ShellOwnershipDescriptorInput>}
 */
export function createShellOwnershipDescriptor(input) {
  if (!isPlainObject(input)) {
    failContract("INVALID_SHELL_OWNERSHIP", "Shell ownership must be a plain object");
  }
  const shellId = String(input.shellId ?? "").trim();
  const ownerChannelId = String(input.ownerChannelId ?? "").trim();
  const collisionClassification = String(input.collisionClassification ?? "").trim();
  const notes = input.notes == null ? "" : String(input.notes).trim();
  const pathHints = Array.isArray(input.pathHints)
    ? input.pathHints.map((p) => String(p).trim()).filter(Boolean)
    : [];

  if (!isNonEmptyString(shellId)) {
    failContract("INVALID_SHELL_ID", "shellId is required");
  }
  if (!isExperienceChannelId(ownerChannelId)) {
    failContract("INVALID_OWNER_CHANNEL", `Unknown ownerChannelId: ${ownerChannelId}`);
  }
  if (!isExperienceChannelClassification(collisionClassification)) {
    failContract("INVALID_COLLISION_CLASSIFICATION", `Invalid classification: ${collisionClassification}`);
  }

  return deepFreeze({
    shellId,
    ownerChannelId,
    collisionClassification,
    pathHints: Object.freeze(pathHints),
    notes,
  });
}

/**
 * @param {ProviderOwnershipDescriptorInput} input
 * @returns {Readonly<ProviderOwnershipDescriptorInput>}
 */
export function createProviderOwnershipDescriptor(input) {
  if (!isPlainObject(input)) {
    failContract("INVALID_PROVIDER_OWNERSHIP", "Provider ownership must be a plain object");
  }
  const providerId = String(input.providerId ?? "").trim();
  const dependency = String(input.dependency ?? "").trim();
  const collisionClassification = String(input.collisionClassification ?? "").trim();
  const notes = input.notes == null ? "" : String(input.notes).trim();
  const pathHints = Array.isArray(input.pathHints)
    ? input.pathHints.map((p) => String(p).trim()).filter(Boolean)
    : [];

  if (!isNonEmptyString(providerId)) {
    failContract("INVALID_PROVIDER_ID", "providerId is required");
  }
  if (!isExperienceProviderDependency(dependency)) {
    failContract("INVALID_PROVIDER_DEPENDENCY", `Invalid dependency: ${dependency}`);
  }
  if (!isExperienceChannelClassification(collisionClassification)) {
    failContract("INVALID_COLLISION_CLASSIFICATION", `Invalid classification: ${collisionClassification}`);
  }

  return deepFreeze({
    providerId,
    dependency,
    collisionClassification,
    pathHints: Object.freeze(pathHints),
    notes,
  });
}
