/**
 * Identity-owned private persistence read for canonical subject point lookup.
 * Competition adapters must not import this module.
 */

import { fetchProfileByUserId } from "../../../auth/profileService.js";

/**
 * @param {string} subjectId
 * @returns {Promise<object|null>}
 */
export async function loadIdentitySubjectByIdFromPersistence(subjectId) {
  const result = await fetchProfileByUserId(subjectId);
  if (!result?.ok || !result.user?.id) return null;
  return result.user;
}
