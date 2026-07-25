/**
 * Report identity helpers (REPORTING-01).
 */

import { createSeededId, requireOpaqueId } from "./shared.js";

/**
 * @param {string} [seed]
 * @returns {string}
 */
export function createReportDefinitionId(seed) {
  return createSeededId("rdef", seed);
}

/**
 * @param {string} [seed]
 * @returns {string}
 */
export function createSavedReportId(seed) {
  return createSeededId("srep", seed);
}

/**
 * @param {string} [seed]
 * @returns {string}
 */
export function createSavedFilterId(seed) {
  return createSeededId("sflt", seed);
}

/**
 * @param {string} [seed]
 * @returns {string}
 */
export function createExecutionId(seed) {
  return createSeededId("rex", seed);
}

/**
 * @param {string} [seed]
 * @returns {string}
 */
export function createExportJobId(seed) {
  return createSeededId("xjob", seed);
}

/**
 * @param {string} [seed]
 * @returns {string}
 */
export function createExportRecordId(seed) {
  return createSeededId("xrec", seed);
}

export {
  requireOpaqueId,
};
