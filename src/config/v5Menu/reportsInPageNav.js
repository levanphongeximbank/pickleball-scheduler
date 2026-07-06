import { FEATURE_STATUS } from "./menuBuilders.js";

export const REPORTS_IN_PAGE_NAV = Object.freeze({
  hubKey: "reports-hub",
  title: "Báo cáo",
  description: "Tổng hợp kinh doanh, hiệu suất sân và xuất dữ liệu.",
  sections: [
    {
      id: "overview",
      label: "Tổng quan",
      items: [
        { key: "report-overview", text: "Tổng quan kinh doanh", path: "/", featureStatus: FEATURE_STATUS.LIVE },
        {
          key: "report-revenue",
          text: "Doanh thu sân",
          path: "/court-management/revenue",
          featureStatus: FEATURE_STATUS.LIVE,
        },
        {
          key: "report-performance",
          text: "Hiệu suất sân",
          path: "/court-management",
          featureStatus: FEATURE_STATUS.LIVE,
        },
        {
          key: "report-occupancy",
          text: "Tỷ lệ lấp đầy sân",
          path: "/",
          featureStatus: FEATURE_STATUS.LIVE,
        },
      ],
    },
    {
      id: "finance",
      label: "Tài chính",
      items: [
        { key: "report-debt-aging", text: "Tuổi công nợ", path: "/finance/debt", featureStatus: FEATURE_STATUS.LIVE },
        { key: "report-receipts", text: "Phiếu thu", path: "/finance/receipts", featureStatus: FEATURE_STATUS.LIVE },
        { key: "report-refunds", text: "Hoàn tiền", path: "/finance/refunds", featureStatus: FEATURE_STATUS.LIVE },
      ],
    },
    {
      id: "segments",
      label: "Phân khúc",
      items: [
        {
          key: "report-customers",
          text: "Khách hàng",
          path: "/court-management/customers",
          featureStatus: FEATURE_STATUS.LIVE,
        },
        {
          key: "report-members",
          text: "Hội viên",
          path: "/court-management/members",
          featureStatus: FEATURE_STATUS.LIVE,
        },
        {
          key: "report-tournament",
          text: "Giải đấu",
          path: "/statistics?view=scoreboard",
          featureStatus: FEATURE_STATUS.LIVE,
        },
        {
          key: "report-coaching",
          text: "Huấn luyện",
          path: "/coaching/evaluations",
          featureStatus: FEATURE_STATUS.LIVE,
        },
        {
          key: "report-peak",
          text: "Giờ cao điểm",
          path: "/court-management/revenue?range=today",
          featureStatus: FEATURE_STATUS.LIVE,
        },
        { key: "report-export", text: "Xuất báo cáo", path: "/statistics", featureStatus: FEATURE_STATUS.LIVE },
      ],
    },
  ],
});
