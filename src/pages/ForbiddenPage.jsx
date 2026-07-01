import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Container, Typography } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";

import { useAuth } from "../context/AuthContext.jsx";
import { getDefaultHomePath } from "../auth/menuAccess.js";

export default function ForbiddenPage() {
  const { user, rbacEnabled } = useAuth();
  const homePath = getDefaultHomePath(user, rbacEnabled);

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        bgcolor: "background.default",
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ textAlign: "center" }}>
          <LockIcon sx={{ fontSize: 56, color: "text.disabled", mb: 2 }} />
          <Typography variant="h4" fontWeight={800} gutterBottom>
            403 — Không có quyền truy cập
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Tài khoản hiện tại không được phép xem trang này.
          </Typography>
          <Button component={RouterLink} to={homePath} variant="contained" sx={{ mr: 1 }}>
            Về trang chính
          </Button>
          <Button component={RouterLink} to="/profile" variant="outlined">
            Hồ sơ của tôi
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
