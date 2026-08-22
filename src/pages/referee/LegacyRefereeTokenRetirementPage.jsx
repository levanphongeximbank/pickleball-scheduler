import { LEGACY_REFEREE_TOKEN_ROUTE_STATUS } from "./legacyRefereeTokenRouteStatus.js";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";

export { LEGACY_REFEREE_TOKEN_ROUTE_STATUS };

export default function LegacyRefereeTokenRetirementPage() {
  return (
    <Box sx={{ maxWidth: 560, mx: "auto", mt: 6, px: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h5" component="h1">
          Link trọng tài cũ đã ngừng dùng
        </Typography>
        <Alert severity="warning" data-testid="legacy-referee-token-isolated">
          Đường dẫn /referee/:token không còn là referee production authority.
          Vui lòng đăng nhập và mở trận từ trang Trọng tài chuẩn.
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Canonical routes: /referee và /referee/match/:matchId
        </Typography>
        <Button
          component={RouterLink}
          to="/referee"
          variant="contained"
          data-testid="legacy-referee-goto-canonical"
        >
          Mở trang Trọng tài
        </Button>
      </Stack>
    </Box>
  );
}
