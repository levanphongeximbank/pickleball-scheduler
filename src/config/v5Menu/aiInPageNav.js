import { PERMISSIONS } from "../../auth/permissions.js";

import { FEATURE_STATUS } from "./menuBuilders.js";



export const AI_IN_PAGE_NAV = Object.freeze({

  hubKey: "ai-hub",

  title: "Trợ lý thông minh",

  description: "Gợi ý vận hành và cảnh báo — bật khi VITE_ENABLE_AI_ENGINE=true.",

  sections: [

    {

      id: "suggestions",

      label: "Gợi ý",

      items: [

        {

          key: "ai-scheduling",

          text: "Gợi ý xếp sân",

          path: "/court-engine?ai=scheduling",

          featureStatus: FEATURE_STATUS.LIVE,

        },

        {

          key: "ai-group",

          text: "Gợi ý chia bảng",

          path: "/tournament?ai=group",

          featureStatus: FEATURE_STATUS.LIVE,

        },

        {

          key: "ai-pairing",

          text: "Gợi ý ghép cặp",

          path: "/tournament?ai=pairing",

          featureStatus: FEATURE_STATUS.LIVE,

        },

        {

          key: "ai-seed",

          text: "Gợi ý xếp hạt giống",

          path: "/tournaments",

          featureStatus: FEATURE_STATUS.LIVE,

        },

        {

          key: "ai-time",

          text: "Dự đoán thời gian giải",

          path: "/tournament?ai=time",

          featureStatus: FEATURE_STATUS.LIVE,

        },

        {

          key: "ai-report-suggest",

          text: "Gợi ý báo cáo",

          path: "/",

          featureStatus: FEATURE_STATUS.LIVE,

        },

      ],

    },

    {

      id: "alerts",

      label: "Cảnh báo",

      items: [

        {

          key: "ai-schedule-conflict",

          text: "Cảnh báo trùng lịch",

          path: "/ai?tab=alerts&focus=schedule-conflict",

          featureStatus: FEATURE_STATUS.LIVE,

        },

        {

          key: "ai-court-overload",

          text: "Cảnh báo quá tải sân",

          path: "/ai?tab=alerts&focus=court-overload",

          featureStatus: FEATURE_STATUS.LIVE,

        },

        {

          key: "ai-crm-suggest",

          text: "Gợi ý chăm sóc khách hàng",

          path: "/crm/messages",
          featureStatus: FEATURE_STATUS.LIVE,

        },

      ],

    },

  ],

});

