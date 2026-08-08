/**
 * Canonical Tournament hub navigation — lifecycle surfaces.
 */
import { TOURNAMENT_ROUTES } from "../../../config/tournamentRoutes.js";

export const CANONICAL_TOURNAMENT_HUB_ITEMS = Object.freeze([
  {
    key: "create",
    title: "Tạo giải",
    description: "Tạo giải mới theo loại hình được hỗ trợ.",
    path: TOURNAMENT_ROUTES.create,
  },
  {
    key: "list",
    title: "Danh sách giải",
    description: "Xem và quản lý toàn bộ giải trong phạm vi hiện tại.",
    path: TOURNAMENT_ROUTES.list,
  },
  {
    key: "types",
    title: "Loại hình giải",
    description: "Chọn thể thức cá nhân/đôi hoặc đồng đội.",
    path: TOURNAMENT_ROUTES.typesHub,
  },
  {
    key: "roster",
    title: "VĐV",
    description: "Danh sách vận động viên và đội trong giải.",
    path: TOURNAMENT_ROUTES.rosterHub,
  },
  {
    key: "register",
    title: "Đăng ký",
    description: "Đăng ký tham gia và duyệt hồ sơ.",
    path: TOURNAMENT_ROUTES.register,
  },
  {
    key: "organize",
    title: "Tổ chức & điều hành",
    description: "Ghép cặp, lịch, sân và điều hành giải.",
    path: TOURNAMENT_ROUTES.organizeHub,
  },
  {
    key: "referee",
    title: "Trọng tài",
    description: "Phân công và vào điểm trọng tài.",
    path: TOURNAMENT_ROUTES.referee,
  },
  {
    key: "results",
    title: "Kết quả",
    description: "Bảng điểm, xếp hạng và kết quả cuối.",
    path: TOURNAMENT_ROUTES.resultsHub,
  },
  {
    key: "my",
    title: "Giải của tôi",
    description: "Các giải bạn đang tham gia hoặc theo dõi.",
    path: TOURNAMENT_ROUTES.playerPortal,
  },
]);
