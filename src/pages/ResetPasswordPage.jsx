import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
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

import {
  completePasswordReset,
  validateDevResetToken,
} from "../features/identity/services/passwordService.js";
import { hasSupabaseConfig } from "../auth/supabaseClient.js";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const devToken = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const devTokenStatus = useMemo(() => {
    if (!devToken || hasSupabaseConfig()) {
      return null;
    }
    return validateDevResetToken(devToken);
  }, [devToken]);

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

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", alignItems: "center", py: 4 }}>
      <Container maxWidth="sm">
        <Card>
          <CardContent>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Đặt lại mật khẩu
            </Typography>

            {hasSupabaseConfig() ? (
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Nhập mật khẩu mới sau khi mở link từ email.
              </Typography>
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
              />
              <TextField
                label="Xác nhận mật khẩu"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                fullWidth
                autoComplete="new-password"
              />
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={!password || !confirm || loading}
              >
                {loading ? "Đang lưu…" : "Lưu mật khẩu mới"}
              </Button>
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
