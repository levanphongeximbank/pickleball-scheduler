/**
 * FileStoragePort — resolve/store attachment blobs elsewhere (COMMS-01).
 * Communication owns attachment references only.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} FileStoragePort
 * @property {(ref: unknown) => Promise<object|null>} resolveAttachment
 * @property {(upload: unknown) => Promise<object>} createAttachmentReference
 */

export const FILE_STORAGE_PORT_METHODS = Object.freeze([
  "resolveAttachment",
  "createAttachmentReference",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesFileStoragePort(port) {
  return matchesPortMethods(port, FILE_STORAGE_PORT_METHODS);
}

/**
 * @returns {FileStoragePort}
 */
export function createUnimplementedFileStoragePort() {
  return {
    async resolveAttachment() {
      throwPortUnimplemented("FileStoragePort", "resolveAttachment");
    },
    async createAttachmentReference() {
      throwPortUnimplemented("FileStoragePort", "createAttachmentReference");
    },
  };
}
