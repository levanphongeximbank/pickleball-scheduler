import { useState } from "react";
import { Link as RouterLink, Navigate, useLocation } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import SecurityIcon from "@mui/icons-material/Security";

import { useAuth } from "../context/AuthContext.jsx";
import { ROLE_LABELS } from "../auth/roles.js";
import { listDevUsers } from "../auth/authService.js";
import { getDefaultHomePath } from "../auth/menuAccess.js";

export default function LoginPage() {
  const location = useLocation();
  const {
    rbacEnabled,
    isAuthenticated,
    user,
    supabaseAvailable,
    signInDev,
    signInWithPassword,
    signUpWithPassword,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authMode, setAuthMode] = useState("signin");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const devUsers = listDevUsers();
  const redirectTo = location.state?.from?.pathname || getDefaultHomePath(user, rbacEnabled);

  if (!rbacEnabled) {
    return <Navigate to="/" replace />;
  }

  if (isAuthenticated && user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSignInDev = (devEmail = email) => {
    const result = signInDev(devEmail);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({
      type: "success",
      text: `Đăng nhập: ${ROLE_LABELS[result.user.role] || result.user.role}`,
    });
  };

  const handleSignInSupabase = async () => {
    setLoading(true);
    const result = await signInWithPassword(email, password);
    setLoading(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    setMessage({
      type: "success",
      text: `Đăng nhập thành công: ${ROLE_LABELS[result.user.role] || result.user.role}`,
    });
  };

  const handleSignUpSupabase = async () => {
    setLoading(true);
    const result = await signUpWithPassword(email, password, {
      display_name: displayName.trim() || email.split("@")[0],
      role: "PLAYER",
    });
    setLoading(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    if (result.needsEmailConfirmation) {
      setMessage({ type: "info", text: result.message });
      return;
    }

    setMessage({
      type: "success",
      text: `Đăng ký thành công: ${ROLE_LABELS[result.user.role] || result.user.role}`,
    });
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        bgcolor: "background.default",
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Stack spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <SportsTennisIcon color="primary" sx={{ fontSize: 48 }} />
          <Typography variant="h4" fontWeight={900} textAlign="center">
            Pickleball Scheduler Pro
          </Typography>
          <Typography color="text.secondary" textAlign="center">
            Đăng nhập để tiếp tục — v3.5.0
          </Typography>
        </Stack>

        <Card>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <SecurityIcon color="primary" />
              <Typography variant="h6" fontWeight="bold">
                Đăng nhập
              </Typography>
            </Stack>

            {message && (
              <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}

            <Stack spacing={2}>
              {!supabaseAvailable && (
                <>
                  <TextField
                    select
                    size="small"
                    label="Tài khoản dev nhanh"
                    value=""
                    onChange={(e) => handleSignInDev(e.target.value)}
                    helperText="Dùng khi chưa cấu hình Supabase"
                  >
                    <MenuItem value="" disabled>
                      Chọn vai trò…
                    </MenuItem>
                    {devUsers.map((devUser) => (
                      <MenuItem key={devUser.id} value={devUser.email}>
                        {ROLE_LABELS[devUser.role]} — {devUser.email}
                      </MenuItem>
                    ))}
                  </TextField>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField
                      size="small"
                      label="Email dev"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@venue.local"
                      fullWidth
                    />
                    <Button variant="contained" onClick={() => handleSignInDev()} disabled={!email.trim()}>
                      Đăng nhập
                    </Button>
                  </Stack>
                </>
              )}

              {supabaseAvailable && (
                <>
                  <Divider />
                  <TextField
                    select
                    size="small"
                    label="Chế độ"
                    value={authMode}
                    onChange={(e) => setAuthMode(e.target.value)}
                  >
                    <MenuItem value="signin">Đăng nhập</MenuItem>
                    <MenuItem value="signup">Đăng ký mới</MenuItem>
                  </TextField>
                  {authMode === "signup" && (
                    <TextField
                      size="small"
                      label="Tên hiển thị"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      fullWidth
                    />
                  )}
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField
                      size="small"
                      label="Email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      fullWidth
                    />
                    <TextField
                      size="small"
                      label="Mật khẩu"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      fullWidth
                    />
                    <Button
                      variant="contained"
                      onClick={authMode === "signup" ? handleSignUpSupabase : handleSignInSupabase}
                      disabled={!email.trim() || !password || loading}
                    >
                      {loading ? "Đang xử lý…" : authMode === "signup" ? "Đăng ký" : "Đăng nhập"}
                    </Button>
                  </Stack>
                </>
              )}

              <Button component={RouterLink} to="/settings" variant="text" size="small">
                Cài đặt & RBAC
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
