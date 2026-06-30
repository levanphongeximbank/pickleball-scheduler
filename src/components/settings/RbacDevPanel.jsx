import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";
import CloudIcon from "@mui/icons-material/Cloud";

import { useAuth } from "../../context/AuthContext.jsx";
import { ROLE_LABELS } from "../../auth/roles.js";
import { listDevUsers } from "../../auth/authService.js";

export default function RbacDevPanel() {
  const {
    authProductionEnabled,
    rbacEnabled,
    isAuthenticated,
    user,
    authProvider,
    supabaseAvailable,
    enableRbac,
    signInDev,
    signInWithPassword,
    signUpWithPassword,
    signOut,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authMode, setAuthMode] = useState("signin");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const devUsers = listDevUsers();

  const handleToggleRbac = (event) => {
    enableRbac(event.target.checked);
    setMessage({
      type: "info",
      text: event.target.checked
        ? "RBAC đã bật — menu và route sẽ lọc theo quyền."
        : "RBAC đã tắt — app hoạt động như trước (full access).",
    });
  };

  const handleSignInDev = () => {
    const result = signInDev(email);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({
      type: "success",
      text: `Đăng nhập dev: ${ROLE_LABELS[result.user.role] || result.user.role}`,
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
      text: `Supabase: ${ROLE_LABELS[result.user.role] || result.user.role}${
        result.warning ? ` (${result.warning})` : ""
      }`,
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

  const handleQuickSignIn = (devEmail) => {
    setEmail(devEmail);
    const result = signInDev(devEmail);
    if (result.ok) {
      setMessage({
        type: "success",
        text: `Đăng nhập dev: ${ROLE_LABELS[result.user.role]}`,
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setEmail("");
    setPassword("");
    setMessage({ type: "info", text: "Đã đăng xuất." });
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <SecurityIcon color="primary" />
          <Typography variant="h6" fontWeight="bold">
            Đăng nhập & Phân quyền
          </Typography>
          <Chip size="small" label={rbacEnabled ? "RBAC bật" : "RBAC tắt"} color={rbacEnabled ? "warning" : "default"} />
          {authProductionEnabled && (
            <Chip size="small" icon={<CloudIcon />} label="Auth production" color="info" variant="outlined" />
          )}
        </Stack>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <FormControlLabel
          control={
            <Switch
              checked={rbacEnabled}
              onChange={handleToggleRbac}
              disabled={authProductionEnabled}
            />
          }
          label={
            authProductionEnabled
              ? "RBAC dev (tắt trong auth production — bật qua VITE_RBAC_ENABLED sau)"
              : "Bật kiểm tra phân quyền RBAC"
          }
          sx={{ mb: 2, display: "block" }}
        />

        {isAuthenticated && user ? (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              {user.displayName || user.email}
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: "wrap" }}>
              <Chip size="small" label={ROLE_LABELS[user.role] || user.role} color="primary" />
              {authProvider && <Chip size="small" variant="outlined" label={`Nguồn: ${authProvider}`} />}
              {user.venueId && <Chip size="small" variant="outlined" label={`Venue: ${user.venueId}`} />}
              {user.clubId && <Chip size="small" variant="outlined" label={`CLB: ${user.clubId}`} />}
            </Stack>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {authProductionEnabled
              ? "Auth production: cần đăng nhập Supabase. RBAC permission chưa enforce."
              : "Chưa đăng nhập. RBAC tắt → full quyền; RBAC bật → cần đăng nhập."}
          </Typography>
        )}

        <Stack spacing={2}>
          {!supabaseAvailable && devUsers.length > 0 && (
            <>
              <TextField
                select
                size="small"
                label="Tài khoản dev nhanh"
                value=""
                onChange={(e) => handleQuickSignIn(e.target.value)}
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
                <Button variant="contained" onClick={handleSignInDev} disabled={!email.trim()}>
                  Đăng nhập dev
                </Button>
              </Stack>
            </>
          )}

          {supabaseAvailable && (
            <>
              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>
                Supabase Auth
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Đăng ký tự tạo profile PLAYER (cần trigger trong docs/supabase-rbac.sql).
              </Typography>
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
                  {loading
                    ? "Đang xử lý…"
                    : authMode === "signup"
                      ? "Đăng ký"
                      : "Đăng nhập"}
                </Button>
              </Stack>
            </>
          )}

          {isAuthenticated && (
            <Button variant="outlined" color="inherit" onClick={handleSignOut} sx={{ alignSelf: "flex-start" }}>
              Đăng xuất
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
