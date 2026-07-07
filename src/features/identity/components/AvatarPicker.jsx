import { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";

import UserAvatar from "../../../components/identity/UserAvatar.jsx";
import {
  removeUserAvatar,
  uploadUserAvatar,
} from "../services/avatarUploadService.js";

export default function AvatarPicker({
  user,
  avatarUrl,
  onAvatarUrlChange,
  onAvatarUpdated,
  disabled = false,
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState(null);

  const previewUser = {
    ...user,
    avatarUrl: avatarUrl || user?.avatarUrl || "",
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setError(null);
    setUploading(true);

    const result = await uploadUserAvatar(file);
    setUploading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onAvatarUrlChange?.(result.avatarUrl);
    onAvatarUpdated?.(result.user);
  };

  const handleRemove = async () => {
    setError(null);
    setRemoving(true);

    const result = await removeUserAvatar();
    setRemoving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onAvatarUrlChange?.("");
    onAvatarUpdated?.(result.user);
  };

  const busy = uploading || removing;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ position: "relative" }}>
          <UserAvatar user={previewUser} size={96} sx={{ fontSize: 32 }} />
          {busy && (
            <CircularProgress
              size={28}
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                mt: "-14px",
                ml: "-14px",
              }}
            />
          )}
        </Box>

        <Stack spacing={1}>
          <Typography variant="subtitle2" fontWeight={700}>
            Hình đại diện
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PhotoCameraIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || busy}
            >
              Chọn ảnh
            </Button>
            {(avatarUrl || user?.avatarUrl) && (
              <Button
                variant="text"
                size="small"
                color="error"
                startIcon={<DeleteOutlinedIcon />}
                onClick={handleRemove}
                disabled={disabled || busy}
              >
                Xóa ảnh
              </Button>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            JPG, PNG hoặc WebP — tối đa 2 MB
          </Typography>
        </Stack>
      </Stack>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={handleFileChange}
      />

      <TextField
        label="URL ảnh"
        value={avatarUrl}
        onChange={(e) => onAvatarUrlChange?.(e.target.value)}
        fullWidth
        disabled={disabled || busy}
        helperText="Tùy chọn — dán link ảnh hoặc upload ở trên, rồi bấm Lưu hồ sơ"
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Stack>
  );
}
