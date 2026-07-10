import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

import GovernanceMemberSelect from "../../../components/club/GovernanceMemberSelect.jsx";
import { assignClubOwner } from "../../../features/club/index.js";

export default function AssignClubOwnerDialog({
  open,
  onClose,
  clubId,
  tenantId,
  candidates = [],
  onSuccess,
  onError,
}) {
  const [ownerUserId, setOwnerUserId] = useState("");
  const [busy, setBusy] = useState(false);

  const handleClose = () => {
    if (busy) {
      return;
    }
    setOwnerUserId("");
    onClose?.();
  };

  const handleAssign = async () => {
    if (!ownerUserId) {
      return;
    }
    setBusy(true);
    const result = await assignClubOwner(clubId, ownerUserId, tenantId);
    setBusy(false);
    if (!result.ok) {
      onError?.(result.error);
      return;
    }
    setOwnerUserId("");
    onSuccess?.();
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Gắn chủ sở hữu CLB</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Chọn thành viên có tài khoản trong CLB để gán vai trò Chủ sở hữu.
        </Typography>
        {candidates.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Chưa có thành viên có tài khoản liên kết trong CLB.
          </Alert>
        )}
        <GovernanceMemberSelect
          label="Chủ sở hữu"
          value={ownerUserId}
          onChange={setOwnerUserId}
          candidates={candidates}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy}>
          Hủy
        </Button>
        <Button variant="contained" onClick={handleAssign} disabled={busy || !ownerUserId}>
          Gắn chủ sở hữu
        </Button>
      </DialogActions>
    </Dialog>
  );
}
