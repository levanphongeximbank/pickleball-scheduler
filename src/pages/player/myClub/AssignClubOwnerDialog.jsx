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

function mapOwnerAssignError(result) {
  const serverCode = String(result?.serverCode || "").trim();
  if (serverCode === "VERSION_CONFLICT") {
    return "Dữ liệu CLB đã thay đổi trên máy chủ. Vui lòng tải lại rồi thử lại.";
  }
  if (serverCode === "FORBIDDEN") {
    return result?.error || "Bạn không có quyền gán Chủ sở hữu CLB.";
  }
  return result?.error || "Không gán được Chủ sở hữu.";
}

export default function AssignClubOwnerDialog({
  open,
  onClose,
  clubId,
  tenantId,
  clubVersion = null,
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
    const result = await assignClubOwner(clubId, ownerUserId, tenantId, {
      expectedClubVersion: clubVersion,
    });
    setBusy(false);
    if (!result.ok) {
      onError?.(mapOwnerAssignError(result));
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
