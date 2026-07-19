/**
 * Deterministic list ordering:
 * displayOrder/sortOrder → normalized code → key → id
 *
 * @param {Array<Record<string, unknown>>} items
 * @returns {Array<Record<string, unknown>>}
 */
export function sortClassificationList(items) {
  const list = Array.isArray(items) ? items.slice() : [];
  list.sort((a, b) => {
    const orderA = Number(a.displayOrder ?? a.sortOrder ?? 0);
    const orderB = Number(b.displayOrder ?? b.sortOrder ?? 0);
    if (orderA !== orderB) {
      return orderA < orderB ? -1 : 1;
    }
    const codeA = String(a.code || "").toLowerCase();
    const codeB = String(b.code || "").toLowerCase();
    if (codeA !== codeB) {
      return codeA < codeB ? -1 : 1;
    }
    const keyA = String(a.key || "");
    const keyB = String(b.key || "");
    if (keyA !== keyB) {
      return keyA < keyB ? -1 : 1;
    }
    const idA = String(a.id || "");
    const idB = String(b.id || "");
    if (idA === idB) return 0;
    return idA < idB ? -1 : 1;
  });
  return list;
}
