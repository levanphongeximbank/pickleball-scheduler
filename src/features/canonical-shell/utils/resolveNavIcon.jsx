import { createElement } from "react";
import DashboardIcon from "@mui/icons-material/Dashboard";
import { getNavIconComponent } from "../../../config/navIcons.js";

const ALIASES = Object.freeze({
  pairing: "ai-pairing",
  mobile: "mobile-player",
  coach: "coaches",
  daily: "tournament-list",
  ranking: "statistics",
  revenue: "report-revenue",
  finance: "payments",
  stats: "statistics",
  reports: "report-overview",
  ai: "ai-group",
  crm: "customers",
  admin: "roles",
  tenant: "tenants",
  club: "club-list",
  tournament: "tournament-list",
  skill: "statistics",
  waiting: "waiting",
  courts: "courts",
  "tong-quan": "dashboard",
  "van-hanh-san": "courts",
  "khach-hang-vdv": "customers",
  "clb-huan-luyen": "club-list",
  "giai-dau": "tournament-list",
  "rating-xep-hang": "statistics",
  "tai-chinh": "payments",
  "bao-cao-phan-tich": "report-overview",
  "ai-assistant": "ai-group",
  "thong-bao": "notifications",
  "public-portal": "dashboard",
  "quan-tri-nen-tang": "roles",
  "ho-tro": "support",
});

export function resolveNavIcon(iconKey) {
  if (!iconKey) return DashboardIcon;
  const mapped = ALIASES[iconKey] || iconKey;
  return getNavIconComponent(mapped) || DashboardIcon;
}

/** Render a nav icon without assigning a dynamic component variable (lint-safe). */
export function renderNavIcon(iconKey, props = {}) {
  return createElement(resolveNavIcon(iconKey), props);
}
