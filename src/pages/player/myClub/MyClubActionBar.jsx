import { Box, Button, Stack, Tooltip } from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import LogoutIcon from "@mui/icons-material/Logout";

import { segmentedTabBarSx, segmentedTabSx } from "./myClubUiStyles.js";

const CLUB_TABS = [
  { id: "home", label: "Trang chủ", requiresClub: true },
  { id: "schedule", label: "Lịch sinh hoạt", requiresClub: true },
  { id: "members", label: "Thành viên", requiresClub: true },
  { id: "discover", label: "Danh sách CLB", requiresClub: false },
];

export default function MyClubActionBar({
  activeView,
  onViewChange,
  hasClub,
  onJoinClick,
  onLeaveClick,
  leaveLoading = false,
}) {
  const visibleTabs = CLUB_TABS.filter((tab) => !tab.requiresClub || hasClub);

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      justifyContent="space-between"
      alignItems={{ xs: "stretch", md: "center" }}
      spacing={1.5}
      sx={{ mb: 2 }}
    >
      <Box sx={segmentedTabBarSx}>
        {visibleTabs.map((tab) => (
          <Button
            key={tab.id}
            onClick={() => onViewChange(tab.id)}
            sx={segmentedTabSx(activeView === tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </Box>

      <Stack direction="row" spacing={1} justifyContent={{ xs: "flex-start", md: "flex-end" }}>
        <Tooltip title={hasClub ? "Bạn đã thuộc một CLB" : ""}>
          <span>
            <Button
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={onJoinClick}
              disabled={hasClub}
            >
              Xin gia nhập CLB
            </Button>
          </span>
        </Tooltip>

        {hasClub && (
          <Button
            variant="outlined"
            color="warning"
            startIcon={<LogoutIcon />}
            onClick={onLeaveClick}
            disabled={leaveLoading}
          >
            Rời câu lạc bộ
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
