import { Box, Button, Stack } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import { Link as RouterLink } from "react-router-dom";

import { CLUB_ROUTE_PATHS } from "../../../features/club/routing/clubMembershipRouteLogic.js";
import { segmentedTabBarSx, segmentedTabSx } from "./myClubUiStyles.js";

const CLUB_TABS = [
  { id: "home", label: "Trang chủ" },
  { id: "schedule", label: "Lịch sinh hoạt" },
  { id: "members", label: "Thành viên" },
];

export default function MyClubActionBar({
  activeView,
  onViewChange,
  onLeaveClick,
  leaveLoading = false,
  showLeave = true,
  showRequestsLink = false,
}) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      justifyContent="space-between"
      alignItems={{ xs: "stretch", md: "center" }}
      spacing={1.5}
      sx={{ mb: 2 }}
    >
      <Box sx={segmentedTabBarSx}>
        {CLUB_TABS.map((tab) => (
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
        {showRequestsLink && (
          <Button
            component={RouterLink}
            to={CLUB_ROUTE_PATHS.REQUESTS}
            variant="outlined"
            size="small"
          >
            Yêu cầu gia nhập
          </Button>
        )}

        {showLeave && (
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
