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
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import SecurityIcon from "@mui/icons-material/Security";
import CloudIcon from "@mui/icons-material/Cloud";

import { useAuth } from "../context/AuthContext.jsx";
import { ROLE_LABELS } from "../auth/roles.js";
import { isDevAuthAllowed, listDevUsers } from "../auth/authService.js";
import { getDefaultHomePath } from "../auth/menuAccess.js";
import { APP_PRODUCT_NAME, APP_VERSION_LABEL, getLoginSubtitle } from "../config/appVersion.js";
import { SHELL_COLORS } from "../components/shell/shellTokens.js";
import {
  SIGNUP_INTENT,
  validateSignupForm,
} from "../features/identity/services/signupService.js";

export default function LoginPage() {
  const location = useLocation();
  const {
    authLoading,
    authError,
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [signupType, setSignupType] = useState(SIGNUP_INTENT.PLAYER);
  const [authMode, setAuthMode] = useState("signin");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const devAuthAllowed = isDevAuthAllowed();
  const devUsers = devAuthAllowed ? listDevUsers() : [];
  const redirectTo = location.state?.from?.pathname || getDefaultHomePath(user, rbacEnabled);
  const authRequired = authProductionEnabled || rbacEnabled;
  const isSignupMode = authMode === "signup";

  if (!authRequired) {
    return <Navigate to="/" replace />;
  }

  if (authLoading && !authError && !isAuthenticated) {
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

  const switchToSignIn = () => {
    setAuthMode("signin");
    setMessage(null);
    setConfirmPassword("");
    setVenueName("");
  };

  const switchToSignUp = () => {
    setAuthMode("signup");
    setMessage(null);
  };

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
    if (!email.trim() || !password) {
      setMessage({ type: "error", text: "Nhập email và mật khẩu." });
      return;
    }

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
    const validation = validateSignupForm({
      email,
      password,
      confirmPassword,
      signupType,
      venueName,
    });

    if (!validation.ok) {
      setMessage({ type: "error", text: validation.error });
      return;
    }

    setLoading(true);
    setMessage(null);
    const result = await signUpWithPassword(validation.normalizedEmail, password, {
      display_name: displayName.trim() || validation.normalizedEmail.split("@")[0],
      signupIntent: signupType,
      venueName: signupType === SIGNUP_INTENT.COURT_OWNER ? venueName : "",
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

  const signupSubmitDisabled =
    loading ||
    !email.trim() ||
    !password ||
    !confirmPassword ||
    (signupType === SIGNUP_INTENT.COURT_OWNER && !venueName.trim());

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        bgcolor: "background.default",
      }}
    >
      <Box
        sx={{
          flex: { md: "0 0 42%" },
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          px: { xs: 3, md: 5, lg: 6 },
          py: { xs: 4, md: 6 },
          bgcolor: SHELL_COLORS.sidebarBg,
          color: SHELL_COLORS.sidebarText,
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            bgcolor: "rgba(255,255,255,0.12)",
            display: "grid",
            placeItems: "center",
            mb: 2,
          }}
        >
          <SportsTennisIcon sx={{ color: SHELL_COLORS.sidebarAccent, fontSize: 28 }} />
        </Box>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 1, fontSize: { xs: 24, md: 28 } }}>
          {APP_PRODUCT_NAME}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            display: "inline-block",
            mb: 2,
            px: 1.25,
            py: 0.35,
            borderRadius: 1,
            bgcolor: "rgba(255,255,255,0.12)",
            color: SHELL_COLORS.sidebarAccent,
            fontWeight: 700,
            letterSpacing: 0.4,
          }}
        >
          {APP_VERSION_LABEL.replace(" Preview", "")}
        </Typography>
        <Typography sx={{ color: SHELL_COLORS.sidebarTextMuted, mb: 3, maxWidth: 360 }}>
          {getLoginSubtitle({ supabaseAvailable })}
        </Typography>
        <Stack spacing={1.5} sx={{ display: { xs: "none", md: "flex" } }}>
          <FeatureBullet icon={SportsTennisIcon} text="Quản lý sân & đặt lịch thông minh" />
          <FeatureBullet icon={CloudIcon} text="Giải đấu & CLB trên một nền tảng" />
          <FeatureBullet icon={SecurityIcon} text="Bảo mật đa tenant cho SaaS V5.0" />
        </Stack>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: { xs: 2, sm: 3 },
          py: { xs: 3, md: 4 },
        }}
      >
        <Container maxWidth="sm" disableGutters sx={{ width: "100%" }}>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", boxShadow: 2 }}>
            <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <SecurityIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>
                  {isSignupMode ? "Đăng ký tài khoản" : "Đăng nhập"}
                </Typography>
              </Stack>

              {(message || authError) && (
                <Alert severity={message?.type || "error"} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
                  {message?.text || authError}
                </Alert>
              )}

              <Stack spacing={2}>
              {supabaseAvailable && !isSignupMode && (
                <Button component={RouterLink} to="/forgot-password" size="small" sx={{ alignSelf: "flex-start" }}>
                  Quên mật khẩu?
                </Button>
              )}

              {devAuthAllowed && devUsers.length > 0 && (
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
                  {isSignupMode && (
                    <>
                      <TextField
                        size="small"
                        label="Tên hiển thị"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        fullWidth
                        autoComplete="name"
                      />
                      <RadioGroup
                        row
                        value={signupType}
                        onChange={(e) => setSignupType(e.target.value)}
                      >
                        <FormControlLabel
                          value={SIGNUP_INTENT.PLAYER}
                          control={<Radio size="small" />}
                          label="Người chơi"
                        />
                        <FormControlLabel
                          value={SIGNUP_INTENT.COURT_OWNER}
                          control={<Radio size="small" />}
                          label="Chủ sân"
                        />
                      </RadioGroup>
                      {signupType === SIGNUP_INTENT.COURT_OWNER && (
                        <TextField
                          size="small"
                          label="Tên sân / CLB"
                          value={venueName}
                          onChange={(e) => setVenueName(e.target.value)}
                          fullWidth
                          helperText="Tạo venue mới và gói dùng thử sau khi đăng ký"
                        />
                      )}
                    </>
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
                    placeholder="email@example.com"
                  />
                  <TextField
                    size="small"
                    label="Mật khẩu"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                    autoComplete={isSignupMode ? "new-password" : "current-password"}
                  />
                  {isSignupMode && (
                    <TextField
                      size="small"
                      label="Xác nhận mật khẩu"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      fullWidth
                      autoComplete="new-password"
                    />
                  )}

                  <Button
                    variant="contained"
                    size="large"
                    onClick={isSignupMode ? handleSignUpSupabase : handleSignInSupabase}
                    disabled={isSignupMode ? signupSubmitDisabled : !email.trim() || !password || loading}
                    fullWidth
                  >
                    {loading ? "Đang xử lý…" : isSignupMode ? "Đăng ký" : "Đăng nhập"}
                  </Button>

                  {!isSignupMode && <Divider />}
                  <Stack
                    direction="row"
                    spacing={0.5}
                    justifyContent="center"
                    alignItems="center"
                    flexWrap="wrap"
                  >
                    {!isSignupMode && (
                      <Typography variant="body2" color="text.secondary">
                        Chưa có tài khoản?
                      </Typography>
                    )}
                    <Button
                      variant="text"
                      size="small"
                      onClick={isSignupMode ? switchToSignIn : switchToSignUp}
                    >
                      {isSignupMode ? "Quay lại đăng nhập" : "Đăng ký tài khoản"}
                    </Button>
                  </Stack>
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
    </Box>
  );
}

function FeatureBullet({ icon: Icon, text }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Icon sx={{ fontSize: 20, color: SHELL_COLORS.sidebarAccent }} />
      <Typography variant="body2" sx={{ color: SHELL_COLORS.sidebarText }}>
        {text}
      </Typography>
    </Stack>
  );
}
