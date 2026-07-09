import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { resolveTenantIdForClub } from "../../../features/tenant/guards/tenantGuard.js";
import { submitClubMembershipRequest } from "../../../features/club/index.js";

export default function JoinClubDialog({
  open,
  onClose,
  user,
  clubs = [],
  preselectedClub = null,
  onSuccess,
  onError,
}) {
  const [selectedClubId, setSelectedClubId] = useState("");
  const [message, setMessage] = useState("");

  const clubOptions = useMemo(() => {
    if (!preselectedClub) {
      return clubs;
    }
    return [preselectedClub, ...clubs.filter((club) => club.id !== preselectedClub.id)];
  }, [clubs, preselectedClub]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedClubId(preselectedClub?.id || "");
    setMessage("");
  }, [open, preselectedClub?.id]);

  const handleSubmit = (event) => {
    event.preventDefault();

    const club =
      preselectedClub || clubOptions.find((item) => item.id === selectedClubId) || null;

    if (!club?.id) {
      onError?.("Chọn CLB để gửi yêu cầu.");
      return;
    }

    const clubTenantId = resolveTenantIdForClub(club.id);
    const result = submitClubMembershipRequest(club.id, clubTenantId, user, { message });

    if (!result.ok) {
      onError?.(result.error);
      return;
    }

    onSuccess?.("Đã gửi yêu cầu tham gia CLB.");
    onClose?.();
  };

  return (
    <Dialog
      key={preselectedClub?.id || "pick-club"}
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>Xin gia nhập CLB</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Chọn CLB và gửi lời nhắn. Chủ tịch hoặc Phó chủ tịch sẽ duyệt yêu cầu.
            </Typography>

            {preselectedClub ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Câu lạc bộ:
                </Typography>
                <Chip label={preselectedClub.name} color="primary" variant="outlined" />
              </Stack>
            ) : (
              <TextField
                select
                label="Câu lạc bộ"
                value={selectedClubId}
                onChange={(event) => setSelectedClubId(event.target.value)}
                fullWidth
                required
              >
                {clubOptions.map((club) => (
                  <MenuItem key={club.id} value={club.id}>
                    {club.name}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Lời nhắn (tùy chọn)"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Giới thiệu ngắn hoặc lý do muốn tham gia CLB..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="contained" disabled={clubOptions.length === 0}>
            Gửi yêu cầu
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
