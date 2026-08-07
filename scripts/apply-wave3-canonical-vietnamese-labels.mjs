/**
 * Wave 3 — apply Vietnamese visible labels into canonicalMenuData.js.
 * Source of truth: src/features/canonical-shell/config/canonicalVietnameseLabels.js
 * Does not change routes, permissions, flags, guards, or node counts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_MENU_DATA } from "../src/features/canonical-shell/config/canonicalMenuData.js";
import {
  BADGE_VIETNAMESE_LABELS,
  LEVEL1_VIETNAMESE_LABELS,
  LEVEL2_VIETNAMESE_LABELS,
  ROUTE_VIETNAMESE_LABELS,
} from "../src/features/canonical-shell/config/canonicalVietnameseLabels.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const menuDataPath = path.join(root, "src/features/canonical-shell/config/canonicalMenuData.js");

const beforeCount = CANONICAL_MENU_DATA.nodes.filter((n) => n.proposedCanonicalMenu).length;

const level1Groups = CANONICAL_MENU_DATA.level1Groups.map((group) => {
  const label = LEVEL1_VIETNAMESE_LABELS[group.id] || group.label;
  return { ...group, label };
});

const nodes = CANONICAL_MENU_DATA.nodes.map((node) => {
  const level1Label = LEVEL1_VIETNAMESE_LABELS[node.level1] || node.level1Label;
  const level2Label =
    LEVEL2_VIETNAMESE_LABELS[node.level2Label] ||
    LEVEL2_VIETNAMESE_LABELS[node.level2] ||
    node.level2Label;
  const label = ROUTE_VIETNAMESE_LABELS[node.route] || node.label;
  const description = level1Label;
  let badge = node.badge;
  if (badge?.label && BADGE_VIETNAMESE_LABELS[badge.label]) {
    badge = { ...badge, label: BADGE_VIETNAMESE_LABELS[badge.label] };
  }
  return {
    ...node,
    label,
    description,
    level1Label,
    level2Label,
    badge,
  };
});

const afterCount = nodes.filter((n) => n.proposedCanonicalMenu).length;
if (beforeCount !== afterCount || nodes.length !== CANONICAL_MENU_DATA.nodes.length) {
  throw new Error(
    `Wave3 label apply must not change node counts (before=${beforeCount}, after=${afterCount})`
  );
}

const nextData = {
  ...CANONICAL_MENU_DATA,
  meta: {
    ...CANONICAL_MENU_DATA.meta,
    generatedAt: new Date().toISOString(),
    localizationWave: 3,
    proposedCanonicalMenuCount: afterCount,
  },
  level1Groups,
  nodes,
};

const source = `/** Auto-derived from Phase 1 CANONICAL_ROUTE_INVENTORY — Phase 2 foundation. Do not hand-edit route authority. Wave 3 labels from canonicalVietnameseLabels.js. */
export const CANONICAL_MENU_DATA = Object.freeze(${JSON.stringify(nextData, null, 2)});
`;

fs.writeFileSync(menuDataPath, source);
console.log("Wave3 labels applied. nodes=", nodes.length, "proposed=", afterCount);
console.log("Routes with explicit overrides:", Object.keys(ROUTE_VIETNAMESE_LABELS).length);
