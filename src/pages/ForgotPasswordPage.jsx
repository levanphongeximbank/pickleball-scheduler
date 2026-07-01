import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
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

import { requestPasswordReset } from "../features/identity/services/passwordService.js";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [devResetPath, setDevResetPath] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setMessage(null);
    setDevResetPath("");

    const result = await requestPasswordReset(email);
    setLoading(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    setMessage({ type: "success", text: result.message });
    if (result.devResetPath) {
      setDevResetPath(result.devResetPath);
    }
  };

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", alignItems: "center", py: 4 }}>
      <Container maxWidth="sm">
        <Card>
          <CardContent>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Quên mật khẩu
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Nhập email để nhận link đặt lại mật khẩu.
            </Typography>

            {message && (
              <Alert severity={message.type} sx={{ mb: 2 }}>
                {message.text}
              </Alert>
            )}

            <Stack spacing={2}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                autoComplete="username"
              />
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={!email.trim() || loading}
              >
                {loading ? "Đang gửi…" : "Gửi link đặt lại"}
              </Button>
              {devResetPath && (
                <Button component={RouterLink} to={devResetPath} variant="outlined">
                  Mở trang đặt lại (dev)
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
