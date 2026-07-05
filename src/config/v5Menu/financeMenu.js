import { PERMISSIONS } from "../../auth/permissions.js";

import { FEATURE_STATUS, menuFolder, menuLeaf } from "./menuBuilders.js";



export const FINANCE_MENU_ROOT = menuFolder({

  key: "finance-root",

  icon: "report-revenue",

  text: "Tài chính",

  children: [

    menuLeaf({

      key: "finance-revenue",

      icon: "report-revenue",

      text: "Doanh thu",

      path: "/court-management/revenue",

      match: "court-revenue",

      permissions: [PERMISSIONS.FINANCE_VIEW],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "orders",

      icon: "orders",

      text: "Đơn hàng",

      path: "/marketplace/orders",

      permissions: [PERMISSIONS.MARKETPLACE_VIEW],

      requiresFeature: "marketplace",

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "payments",

      icon: "payments",

      text: "Thanh toán",

      path: "/billing/payment",

      permissions: [PERMISSIONS.BILLING_PAYMENT_VIEW, PERMISSIONS.BILLING_VIEW],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "debt",

      icon: "debt",

      text: "Công nợ",

      path: "/finance/debt",

      match: "finance-debt",

      permissions: [PERMISSIONS.FINANCE_VIEW],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "finance-receipts",

      icon: "payments",

      text: "Phiếu thu",

      path: "/finance/receipts",

      match: "finance-receipts",

      permissions: [PERMISSIONS.FINANCE_VIEW],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "finance-refunds",

      icon: "payments",

      text: "Hoàn tiền",

      path: "/finance/refunds",

      match: "finance-refunds",

      permissions: [PERMISSIONS.FINANCE_VIEW],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

  ],

});

