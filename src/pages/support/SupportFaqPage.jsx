import { Box, Typography } from "@mui/material";

const FAQ_ITEMS = [
  {
    q: "Làm sao chuyển CLB / cơ sở?",
    a: "Dùng bộ chọn ở header — mọi module pilot (huấn luyện, xếp sân) đọc theo CLB/cơ sở đang chọn.",
  },
  {
    q: "Dữ liệu huấn luyện lưu ở đâu?",
    a: "Phase 28 lưu localStorage theo CLB. SQL draft trong docs/v5/PHASE_28_COACHING.sql chuẩn bị cloud sau.",
  },
  {
    q: "Cảnh báo trùng lịch / quá tải sân hoạt động thế nào?",
    a: "Engine AI đọc booking + lịch huấn luyện, so khung giờ và số sân. Xem tab Cảnh báo tại /ai.",
  },
  {
    q: "RBAC bật nhưng menu thiếu mục?",
    a: "Kiểm tra role và permission trên profile. SUPER_ADMIN thấy đủ nhóm Quản trị.",
  },
  {
    q: "Liên hệ hỗ trợ?",
    a: "Dùng tab Yêu cầu hỗ trợ hoặc Liên hệ trong hub Hỗ trợ (/support).",
  },
];

export default function SupportFaqPage() {
  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Câu hỏi thường gặp
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        FAQ cho vận hành Pickleball Scheduler Pro v5.
      </Typography>
      {FAQ_ITEMS.map((item) => (
        <Box key={item.q} sx={{ mb: 2 }}>
          <Typography fontWeight={600}>{item.q}</Typography>
          <Typography color="text.secondary">{item.a}</Typography>
        </Box>
      ))}
    </Box>
  );
}
