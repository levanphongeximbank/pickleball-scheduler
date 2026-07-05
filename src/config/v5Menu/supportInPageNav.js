import { FEATURE_STATUS } from "./menuBuilders.js";

export const SUPPORT_IN_PAGE_NAV = Object.freeze({
  hubKey: "support-hub",
  title: "Hỗ trợ",
  description: "Hướng dẫn, FAQ và liên hệ đội ngũ Pickleball Scheduler Pro.",
  sections: [
    {
      id: "help",
      label: "Trợ giúp",
      items: [
        { key: "support-guide", text: "Hướng dẫn sử dụng", path: "/support?tab=guide", featureStatus: FEATURE_STATUS.LIVE },
        { key: "support-faq", text: "Câu hỏi thường gặp", path: "/support?tab=faq", featureStatus: FEATURE_STATUS.LIVE },
        {
          key: "support-ticket",
          text: "Yêu cầu hỗ trợ",
          path: "/billing/support?tab=ticket",
          featureStatus: FEATURE_STATUS.LIVE,
        },
        {
          key: "support-feedback-product",
          text: "Góp ý sản phẩm",
          path: "/support?tab=feedback",
          featureStatus: FEATURE_STATUS.LIVE,
        },
        {
          key: "support-contact",
          text: "Liên hệ hỗ trợ",
          path: "/billing/support?tab=contact",
          featureStatus: FEATURE_STATUS.LIVE,
        },
        { key: "profile", text: "Hồ sơ của tôi", path: "/profile", featureStatus: FEATURE_STATUS.LIVE },
      ],
    },
  ],
});
