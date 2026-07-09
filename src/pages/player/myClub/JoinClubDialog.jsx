import {
  Button,
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
  const selectedClubId = preselectedClub?.id || "";
  const clubOptions = preselectedClub
    ? [preselectedClub, ...clubs.filter((club) => club.id !== preselectedClub.id)]
    : clubs;

  const handleSubmit = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const clubId = String(formData.get("clubId") || "").trim();
    const message = String(formData.get("message") || "");

    const club = clubOptions.find((item) => item.id === clubId);
    if (!club) {
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Xin gia nhập CLB</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Chọn CLB và gửi lời nhắn. Chủ tịch hoặc Phó chủ tịch sẽ duyệt yêu cầu.
            </Typography>
            <TextField
              select
              name="clubId"
              label="Câu lạc bộ"
              defaultValue={selectedClubId}
              fullWidth
              required
              disabled={Boolean(preselectedClub)}
            >
              {clubOptions.map((club) => (
                <MenuItem key={club.id} value={club.id}>
                  {club.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              name="message"
              fullWidth
              multiline
              minRows={3}
              label="Lời nhắn (tùy chọn)"
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
