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
import CloudIcon from "@mui/icons-material/Cloud";

import { useAuth } from "../context/AuthContext.jsx";
import { ROLE_LABELS } from "../auth/roles.js";
import { listDevUsers } from "../auth/authService.js";
import { getDefaultHomePath } from "../auth/menuAccess.js";

export default function LoginPage() {
  const location = useLocation();
  const {
    authLoading,
    authProductionEnabled,
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
  const authRequired = authProductionEnabled || rbacEnabled;

  if (!authRequired) {
    return <Navigate to="/" replace />;
  }

  if (authLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography color="text.secondary">Đang tải phiên đăng nhập…</Typography>
      </Box>
    );
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
    setMessage(null);
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
    setMessage(null);
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
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        bgcolor: "background.default",
        py: { xs: 3, sm: 4 },
        px: { xs: 1.5, sm: 0 },
      }}
    >
      <Container maxWidth="sm">
        <Stack spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <SportsTennisIcon color="primary" sx={{ fontSize: { xs: 40, sm: 48 } }} />
          <Typography variant="h4" fontWeight={900} textAlign="center" sx={{ fontSize: { xs: 24, sm: 34 } }}>
            Pickleball Scheduler Pro
          </Typography>
          <Typography color="text.secondary" textAlign="center" variant="body2">
            {supabaseAvailable ? (
              <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                <CloudIcon fontSize="small" />
                <span>Đăng nhập bảo mật — v3.5.3</span>
              </Stack>
            ) : (
              "Đăng nhập dev — v3.5.3"
            )}
          </Typography>
        </Stack>

        <Card elevation={2}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
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
              {!supabaseAvailable && devUsers.length > 0 && (
                <>
                  <TextField
                    select
                    size="small"
                    label="Tài khoản dev nhanh"
                    value=""
                    onChange={(e) => handleSignInDev(e.target.value)}
                    helperText="Chỉ dùng khi chưa cấu hình Supabase"
                    fullWidth
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
                      autoComplete="username"
                    />
                    <Button
                      variant="contained"
                      onClick={() => handleSignInDev()}
                      disabled={!email.trim()}
                      fullWidth
                      sx={{ minWidth: { sm: 140 }, flexShrink: 0 }}
                    >
                      Đăng nhập
                    </Button>
                  </Stack>
                </>
              )}

              {supabaseAvailable && (
                <>
                  <TextField
                    select
                    size="small"
                    label="Chế độ"
                    value={authMode}
                    onChange={(e) => setAuthMode(e.target.value)}
                    fullWidth
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
                      autoComplete="name"
                    />
                  )}
                  <TextField
                    size="small"
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    fullWidth
                    autoComplete="username"
                    inputMode="email"
                  />
                  <TextField
                    size="small"
                    label="Mật khẩu"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                    autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                  />
                  <Button
                    variant="contained"
                    size="large"
                    onClick={authMode === "signup" ? handleSignUpSupabase : handleSignInSupabase}
                    disabled={!email.trim() || !password || loading}
                    fullWidth
                  >
                    {loading ? "Đang xử lý…" : authMode === "signup" ? "Đăng ký" : "Đăng nhập"}
                  </Button>
                </>
              )}

              {!authProductionEnabled && (
                <>
                  <Divider />
                  <Button component={RouterLink} to="/settings" variant="text" size="small">
                    Cài đặt & RBAC dev
                  </Button>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
