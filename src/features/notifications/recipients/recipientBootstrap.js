import {
  setDefaultRecipientDirectory,
  getRecipientDirectory,
  setRecipientDirectory,
  resetRecipientDirectory,
  createMemoryRecipientDirectory,
  createEmptyRecipientDirectory,
} from "./recipientDirectory.js";
import {
  createIdentityMembershipDirectory,
  createDefaultIdentityDirectory,
} from "./identityMembershipDirectory.js";

/**
 * Ensure the process default directory is the identity/membership directory.
 * Safe to call multiple times.
 */
export function ensureIdentityRecipientDirectory(options = {}) {
  const current = getRecipientDirectory();
  if (current?.kind === "identity-membership" && options.force !== true) {
    return current;
  }
  const directory = createIdentityMembershipDirectory(options);
  setDefaultRecipientDirectory(directory);
  return directory;
}

export {
  createIdentityMembershipDirectory,
  createDefaultIdentityDirectory,
  createMemoryRecipientDirectory,
  createEmptyRecipientDirectory,
  setRecipientDirectory,
  resetRecipientDirectory,
  getRecipientDirectory,
  setDefaultRecipientDirectory,
};
