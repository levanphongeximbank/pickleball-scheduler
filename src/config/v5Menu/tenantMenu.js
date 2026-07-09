import { PERMISSIONS } from "../../auth/permissions.js";

import { FEATURE_STATUS, menuFolder, menuLeaf } from "./menuBuilders.js";

/** Gói thuê / billing self-service cho chủ tenant. */
export const TENANT_MENU_ROOT = menuFolder({
  key: "tenant-billing-root",
  icon: "tenants",
  text: "Tenant",
  children: [
    menuLeaf({
      key: "billing-current-plan",
      icon: "subscription",
      text: "Gói hiện tại",
      path: "/billing/current-plan",
      match: "billing-current-plan",
      permissions: [PERMISSIONS.BILLING_VIEW],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "billing-upgrade",
      icon: "billing",
      text: "Nâng cấp gói",
      path: "/billing/upgrade",
      match: "billing-upgrade",
      permissions: [PERMISSIONS.BILLING_SUBSCRIPTION_VIEW, PERMISSIONS.BILLING_VIEW],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
  ],
});
