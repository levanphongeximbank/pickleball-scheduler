import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  completePasswordReset,
  validateDevResetToken,
} from "../features/identity/services/passwordService.js";
import { ensureRecoverySession } from "../auth/authService.js";
import { hasSupabaseConfig } from "../auth/supabaseClient.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const devToken = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [sessionCheck, setSessionCheck] = useState({ loading: hasSupabaseConfig(), ready: null });

  const devTokenStatus = useMemo(() => {
    if (!devToken || hasSupabaseConfig()) {
      return null;
    }
    return validateDevResetToken(devToken);
  }, [devToken]);

  useEffect(() => {
    if (!hasSupabaseConfig() || authLoading) {
      return undefined;
    }

    let cancelled = false;
    setSessionCheck({ loading: true, ready: null });

    void ensureRecoverySession().then((result) => {
      if (cancelled) {
        return;
      }
      setSessionCheck({ loading: false, ready: result.ok, error: result.ok ? null : result.error });
    });

    return () => {
      cancelled = true;
    };
  }, [authLoading]);

  const handleSubmit = async () => {
    if (password !== confirm) {
      setMessage({ type: "error", text: "Mật khẩu xác nhận không khớp." });
      return;
    }

    setLoading(true);
    setMessage(null);

    const result = await completePasswordReset({
      password,
      token: devToken || null,
    });

    setLoading(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    setMessage({ type: "success", text: result.message });
    setTimeout(() => navigate("/login", { replace: true }), 1200);
  };

  const recoveryBlocked = hasSupabaseConfig() && !sessionCheck.loading && sessionCheck.ready === false;

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", alignItems: "center", py: 4 }}>
      <Container maxWidth="sm">
        <Card>
          <CardContent>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Đặt lại mật khẩu
            </Typography>

            {hasSupabaseConfig() ? (
              sessionCheck.loading || authLoading ? (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <CircularProgress size={18} />
                  <Typography color="text.secondary">Đang xác thực link từ email…</Typography>
                </Stack>
              ) : recoveryBlocked ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {sessionCheck.error ||
                    "Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Gửi email reset mới và mở link ngay."}
                </Alert>
              ) : (
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Nhập mật khẩu mới cho tài khoản của bạn.
                </Typography>
              )
            ) : devTokenStatus && !devTokenStatus.ok ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {devTokenStatus.error}
              </Alert>
            ) : (
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Dev mode — token hợp lệ cho {devTokenStatus?.email || "email"}.
              </Typography>
            )}

            {message && (
              <Alert severity={message.type} sx={{ mb: 2 }}>
                {message.text}
              </Alert>
            )}

            <Stack spacing={2}>
              <TextField
                label="Mật khẩu mới"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                autoComplete="new-password"
                disabled={recoveryBlocked || sessionCheck.loading || authLoading}
              />
              <TextField
                label="Xác nhận mật khẩu"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                fullWidth
                autoComplete="new-password"
                disabled={recoveryBlocked || sessionCheck.loading || authLoading}
              />
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={
                  !password ||
                  !confirm ||
                  loading ||
                  recoveryBlocked ||
                  sessionCheck.loading ||
                  authLoading
                }
              >
                {loading ? "Đang lưu…" : "Lưu mật khẩu mới"}
              </Button>
              {recoveryBlocked && (
                <Button component={RouterLink} to="/forgot-password" variant="outlined">
                  Gửi email reset mới
                </Button>
              )}
              <Button component={RouterLink} to="/login" size="small">
                Quay lại đăng nhập
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
