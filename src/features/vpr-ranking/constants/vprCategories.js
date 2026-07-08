import { EVENT_TYPE } from "../../../models/tournament/constants.js";

export const VPR_CATEGORY = {
  MEN_SINGLE: "men_single",
  WOMEN_SINGLE: "women_single",
  MEN_DOUBLE: "men_double",
  WOMEN_DOUBLE: "women_double",
  MIXED_DOUBLE: "mixed_double",
  TEAM: "team",
};

export const VPR_CATEGORY_LABELS = {
  [VPR_CATEGORY.MEN_SINGLE]: "Đơn nam",
  [VPR_CATEGORY.WOMEN_SINGLE]: "Đơn nữ",
  [VPR_CATEGORY.MEN_DOUBLE]: "Đôi nam",
  [VPR_CATEGORY.WOMEN_DOUBLE]: "Đôi nữ",
  [VPR_CATEGORY.MIXED_DOUBLE]: "Đôi nam nữ",
  [VPR_CATEGORY.TEAM]: "Đồng đội",
};

export const VPR_CATEGORY_OPTIONS = Object.values(VPR_CATEGORY).map((id) => ({
  id,
  label: VPR_CATEGORY_LABELS[id],
}));

/** Map tournament eventType → VPR category. open_double excluded in V1. */
export function eventTypeToVprCategory(eventType) {
  const raw = String(eventType || "").trim().toLowerCase();
  const map = {
    [EVENT_TYPE.MEN_SINGLE]: VPR_CATEGORY.MEN_SINGLE,
    [EVENT_TYPE.WOMEN_SINGLE]: VPR_CATEGORY.WOMEN_SINGLE,
    [EVENT_TYPE.MEN_DOUBLE]: VPR_CATEGORY.MEN_DOUBLE,
    [EVENT_TYPE.WOMEN_DOUBLE]: VPR_CATEGORY.WOMEN_DOUBLE,
    [EVENT_TYPE.MIXED_DOUBLE]: VPR_CATEGORY.MIXED_DOUBLE,
  };
  return map[raw] || null;
}

export function vprCategoryToGenderFilter(category) {
  switch (category) {
    case VPR_CATEGORY.MEN_SINGLE:
    case VPR_CATEGORY.MEN_DOUBLE:
      return "male";
    case VPR_CATEGORY.WOMEN_SINGLE:
    case VPR_CATEGORY.WOMEN_DOUBLE:
      return "female";
    default:
      return null;
  }
}
