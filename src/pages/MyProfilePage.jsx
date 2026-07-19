import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { useAuth } from "../context/AuthContext.jsx";
import { ROLE_LABELS } from "../auth/roles.js";
import { USER_STATUS } from "../models/user.js";
import {
  fetchSelfProfile,
  updateSelfProfile,
} from "../features/identity/services/selfProfileService.js";
import { changePassword } from "../features/identity/services/passwordService.js";
import AvatarPicker from "../features/identity/components/AvatarPicker.jsx";
import { useAuthenticatedSelfPlayerProfile } from "../features/player/hooks/useAuthenticatedSelfPlayerProfile.js";
import SelfPlayerProfileFoundationRead from "../features/player/components/SelfPlayerProfileFoundationRead.jsx";

const STATUS_LABELS = {
  [USER_STATUS.ACTIVE]: "Đang hoạt động",
  [USER_STATUS.INVITED]: "Đã mời",
  [USER_STATUS.SUSPENDED]: "Tạm khóa",
};

export default function MyProfilePage() {
  const { user, refresh } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const playerProfileRead = useAuthenticatedSelfPlayerProfile({
    authUserId: user?.id || null,
    enabled: Boolean(user?.id),
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result = await fetchSelfProfile();
      if (cancelled || !result.ok) {
        return;
      }
      setDisplayName(result.user.displayName || "");
      setPhone(result.user.phone || "");
      setAvatarUrl(result.user.avatarUrl || "");
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleSaveProfile = async () => {
    setLoading(true);
    setMessage(null);
    const result = await updateSelfProfile({ displayName, phone, avatarUrl });
    setLoading(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    refresh();
    playerProfileRead.reload();
    setMessage({ type: "success", text: "Đã cập nhật hồ sơ." });
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Mật khẩu xác nhận không khớp." });
      return;
    }

    setLoading(true);
    setMessage(null);
    const result = await changePassword({ currentPassword, newPassword });
    setLoading(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage({ type: "success", text: result.message });
  };

  if (!user) {
    return (
      <Alert severity="warning">Vui lòng đăng nhập để xem hồ sơ.</Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        Hồ sơ của tôi
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Thông tin cá nhân
              </Typography>
              <Stack spacing={2}>
                <AvatarPicker
                  user={user}
                  avatarUrl={avatarUrl}
                  onAvatarUrlChange={setAvatarUrl}
                  onAvatarUpdated={() => {
                    refresh();
                    setMessage({ type: "success", text: "Đã cập nhật hình đại diện." });
                  }}
                  disabled={loading}
                />
                <TextField label="Email" value={user.email} disabled fullWidth />
                <TextField
                  label="Họ tên"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Số điện thoại"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  fullWidth
                />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Vai trò:
                  </Typography>
                  <Chip
                    size="small"
                    label={ROLE_LABELS[user.role] || user.role}
                    color="primary"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Trạng thái: {STATUS_LABELS[user.status] || user.status}
                  </Typography>
                </Stack>
                <Button variant="contained" onClick={handleSaveProfile} disabled={loading}>
                  Lưu hồ sơ
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <SelfPlayerProfileFoundationRead
                status={playerProfileRead.status}
                message={playerProfileRead.message}
                fields={playerProfileRead.fields}
                onRetry={playerProfileRead.reload}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Đổi mật khẩu
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Mật khẩu hiện tại"
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
                  variant="outlined"
                  onClick={handleChangePassword}
                  disabled={loading || !currentPassword || !newPassword}
                >
                  Đổi mật khẩu
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
