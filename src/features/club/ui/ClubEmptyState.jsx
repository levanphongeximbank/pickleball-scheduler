import { Box, Button, Stack, Typography } from "@mui/material";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";

const PRESETS = {
  discover: {
    Icon: GroupsOutlinedIcon,
    title: "Chưa có CLB đang hoạt động",
    description: "Hệ thống chưa có CLB khả dụng hoặc bạn chưa có quyền xem.",
  },
  discoverSearch: {
    Icon: SearchOffIcon,
    title: "Không tìm thấy CLB",
    description: "Thử từ khóa khác hoặc xóa bộ lọc tìm kiếm.",
  },
  registry: {
    Icon: GroupsOutlinedIcon,
    title: "Chưa có CLB trong tenant",
    description: "Tạo CLB mới hoặc điều chỉnh bộ lọc trạng thái.",
  },
  registryFilter: {
    Icon: SearchOffIcon,
    title: "Không có CLB phù hợp",
    description: "Thử đổi bộ lọc hoặc tìm kiếm khác.",
  },
  members: {
    Icon: GroupsOutlinedIcon,
    title: "Chưa có thành viên",
    description: "Danh sách thành viên sẽ hiển thị tại đây.",
  },
  requests: {
    Icon: GroupsOutlinedIcon,
    title: "Không có yêu cầu đang chờ",
    description: "VĐV gửi yêu cầu từ Khám phá CLB — duyệt tại đây.",
  },
};

export default function ClubEmptyState({
  preset = "discover",
  title,
  description,
  actionLabel,
  onAction,
  sx = {},
}) {
  const cfg = PRESETS[preset] || PRESETS.discover;
  const Icon = cfg.Icon;

  return (
    <Box
      role="status"
      sx={{
        py: 5,
        px: 2,
        textAlign: "center",
        borderRadius: 2,
        border: "1px dashed",
        borderColor: "divider",
        bgcolor: "background.default",
        ...sx,
      }}
    >
      <Icon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} aria-hidden />
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        {title || cfg.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: "auto" }}>
        {description || cfg.description}
      </Typography>
      {actionLabel && onAction && (
        <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
          <Button variant="contained" onClick={onAction}>
            {actionLabel}
          </Button>
        </Stack>
      )}
    </Box>
  );
}
