import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { useAuth } from "../context/AuthContext.jsx";
import { completeMandatoryPasswordChange } from "../features/identity/services/passwordService.js";
import { getDefaultHomePath } from "../auth/menuAccess.js";

export default function ForceChangePasswordPage() {
  const navigate = useNavigate();
  const { user, rbacEnabled, refresh, isAuthenticated, authLoading } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  if (authLoading) {
    return (
      <Box sx={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography color="text.secondary">Đang tải…</Typography>
      </Box>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.mustChangePassword) {
    const homePath = getDefaultHomePath(user, rbacEnabled);
    return <Navigate to={homePath || "/"} replace />;
  }

  const handleSubmit = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Mật khẩu xác nhận không khớp." });
      return;
    }

    setLoading(true);
    setMessage(null);

    const result = await completeMandatoryPasswordChange({
      currentPassword,
      newPassword,
    });

    setLoading(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    refresh();
    setMessage({ type: "success", text: result.message });
    const homePath = getDefaultHomePath(result.user || user, rbacEnabled);
    setTimeout(() => navigate(homePath || "/", { replace: true }), 800);
  };

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", alignItems: "center", py: 4 }}>
      <Container maxWidth="sm">
        <Card>
          <CardContent>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Đổi mật khẩu lần đầu
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Tài khoản được tạo bởi quản trị viên. Vui lòng đặt mật khẩu mới trước khi tiếp tục.
            </Typography>

            {message && (
              <Alert severity={message.type} sx={{ mb: 2 }}>
                {message.text}
              </Alert>
            )}

            <Stack spacing={2}>
              <TextField
                label="Mật khẩu tạm (hiện tại)"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                fullWidth
                autoComplete="current-password"
              />
              <TextField
                label="Mật khẩu mới"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                fullWidth
                autoComplete="new-password"
              />
              <TextField
                label="Xác nhận mật khẩu mới"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                fullWidth
                autoComplete="new-password"
              />
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={!currentPassword || !newPassword || !confirmPassword || loading}
              >
                {loading ? "Đang lưu…" : "Lưu mật khẩu mới"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
