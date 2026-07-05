import { Box, List, ListItem, ListItemText, Typography } from "@mui/material";

const GUIDE_SECTIONS = [
  {
    title: "Bắt đầu nhanh",
    items: [
      "Chọn cơ sở và CLB ở header trước khi thao tác.",
      "Menu Tổng quan hiển thị KPI vận hành theo cơ sở.",
      "Module Giải đấu dùng hub in-page — không cần sidebar sâu hơn 2 cấp.",
    ],
  },
  {
    title: "Vận hành sân",
    items: [
      "Lịch sân / Đặt sân: quản lý booking và doanh thu.",
      "Xếp sân (Court Engine): phiên xếp gắn CLB, mùa, giải.",
      "Trợ lý AI: bật VITE_ENABLE_AI_ENGINE=true để xem gợi ý và cảnh báo.",
    ],
  },
  {
    title: "Huấn luyện",
    items: [
      "HLV, học viên, lớp, lịch, gói học, điểm danh, đánh giá — lưu local theo CLB.",
      "Dữ liệu pilot chưa đồng bộ cloud — export thủ công nếu cần backup.",
    ],
  },
];

export default function SupportGuidePage() {
  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Hướng dẫn sử dụng
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Tài liệu nhanh cho chủ sân và ban tổ chức giải.
      </Typography>
      {GUIDE_SECTIONS.map((section) => (
        <Box key={section.title} sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>{section.title}</Typography>
          <List dense>
            {section.items.map((item) => (
              <ListItem key={item} disableGutters>
                <ListItemText primary={item} />
              </ListItem>
            ))}
          </List>
        </Box>
      ))}
    </Box>
  );
}
