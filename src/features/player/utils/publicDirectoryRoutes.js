/**
 * Phase 1I-D — Public Player Directory route helpers.
 * playerId is used only for path construction; never displayed as UI text here.
 */

export const PUBLIC_DIRECTORY_LIST_PATH = "/athletes";

/**
 * @param {unknown} playerId
 * @returns {string|null} `/athletes/:playerId` or null when id is empty
 */
export function buildPublicDirectoryPlayerPath(playerId) {
  const id = String(playerId ?? "").trim();
  if (!id) return null;
  return `${PUBLIC_DIRECTORY_LIST_PATH}/${encodeURIComponent(id)}`;
}
