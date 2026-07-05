import { SIDEBAR_MAX_FOLDER_DEPTH } from "./menuBuilders.js";

/**
 * Kiểm tra sidebar không có folder lồng (chỉ lá phẳng dưới mỗi nhóm).
 * @param {object[]} groups — MENU_GROUPS đã filter
 */
export function auditSidebarMenuDepth(groups) {
  const violations = [];

  function walk(items, folderDepth, trail) {
    for (const item of items || []) {
      const nextTrail = [...trail, item.text].filter(Boolean);
      if (item.children?.length) {
        if (folderDepth > SIDEBAR_MAX_FOLDER_DEPTH) {
          violations.push({
            trail: nextTrail.join(" › "),
            folderDepth,
            key: item.key,
          });
        }
        walk(item.children, folderDepth + 1, nextTrail);
      }
    }
  }

  for (const group of groups || []) {
    for (const root of group.items || []) {
      walk(root.children || [], 0, [group.label || group.id]);
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    maxFolderDepth: SIDEBAR_MAX_FOLDER_DEPTH,
  };
}
