/**
 * Content repository port (NEWS-01) — contract only; no durable adapter.
 */

import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import { NewsPublicContentError } from "../errors/NewsPublicContentError.js";

export const CONTENT_REPOSITORY_PORT_METHODS = Object.freeze([
  "getByContentId",
  "save",
  "queryPublicCandidates",
  "findSlugCollision",
  "detectVersionConflict",
]);

export const NEWS_CONTENT_REPOSITORY_PORTS = Object.freeze({
  getByContentId: "getByContentId",
  save: "save",
  queryPublicCandidates: "queryPublicCandidates",
  findSlugCollision: "findSlugCollision",
  detectVersionConflict: "detectVersionConflict",
});

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesContentRepositoryPort(port) {
  if (!port || typeof port !== "object") return false;
  return CONTENT_REPOSITORY_PORT_METHODS.every(
    (m) => typeof /** @type {Record<string, unknown>} */ (port)[m] === "function"
  );
}

/**
 * @param {string} method
 * @returns {never}
 */
function throwUnimplemented(method) {
  throw new NewsPublicContentError(
    NEWS_PUBLIC_CONTENT_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
    `ContentRepositoryPort.${method} is not implemented`,
    { portName: "ContentRepositoryPort", method }
  );
}

/**
 * Fail-closed unimplemented port for NEWS-01 (no silent mock SoT).
 */
export function createUnimplementedContentRepositoryPort() {
  return {
    async getByContentId() {
      throwUnimplemented("getByContentId");
    },
    async save() {
      throwUnimplemented("save");
    },
    async queryPublicCandidates() {
      throwUnimplemented("queryPublicCandidates");
    },
    async findSlugCollision() {
      throwUnimplemented("findSlugCollision");
    },
    async detectVersionConflict() {
      throwUnimplemented("detectVersionConflict");
    },
  };
}
