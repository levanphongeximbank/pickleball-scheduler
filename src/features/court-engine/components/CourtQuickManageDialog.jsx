import { useEffect, useMemo, useState } from "react";

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";

import { PERMISSIONS } from "../../../auth/permissions.js";
import { resolveRouteAccessScope } from "../../../auth/menuAccess.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import {
  loadCourts,
  saveCourts,
  upsertCourt,
  validateCourtLimit,
  validateCourtName,
} from "../../../pages/courts.logic.js";

export default function CourtQuickManageDialog({
  open,
  onClose,
  editingCourt = null,
  clubId = null,
  onSaved,
}) {
  const { activeClubId, activeClub } = useClub();
  const targetClubId = clubId || editingCourt?.clubId || activeClubId;
  const { can, rbacEnabled, isAuthenticated, user } = useAuth();
  const scope = useMemo(
    () => resolveRouteAccessScope({ user, activeClubId: targetClubId, activeClub }),
    [user, targetClubId, activeClub]
  );
  const canCreate =
    !rbacEnabled || !isAuthenticated || can(PERMISSIONS.COURT_CREATE, scope);
  const canUpdate =
    !rbacEnabled || !isAuthenticated || can(PERMISSIONS.COURT_UPDATE, scope);

  const [courtName, setCourtName] = useState("");
  const [courtNumber, setCourtNumber] = useState("");
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setCourtName(editingCourt?.name || "");
    setCourtNumber(editingCourt?.number ?? "");
    setFormError(null);
  }, [open, editingCourt]);

  const handleSave = () => {
    const nameError = validateCourtName(courtName);
    if (nameError) {
      setFormError(nameError);
      return;
    }

    if (!editingCourt) {
      const limitError = validateCourtLimit(targetClubId, { isNew: true });
      if (limitError) {
        setFormError(limitError);
        return;
      }
      if (!canCreate) {
        setFormError("Không có quyền thêm sân.");
        return;
      }
    } else if (!canUpdate) {
      setFormError("Không có quyền sửa sân.");
      return;
    }

    const courts = loadCourts([], targetClubId);
    const updatedCourts = upsertCourt(courts, {
      courtName,
      courtNumber,
      editingCourt,
      extra: {
        active: editingCourt?.active !== false,
        status: editingCourt?.status || "active",
      },
    });

    const permission = editingCourt ? PERMISSIONS.COURT_UPDATE : PERMISSIONS.COURT_CREATE;
    const result = saveCourts(updatedCourts, targetClubId, { permission });
    if (!result.ok) {
      setFormError(result.error || "Không thể lưu sân.");
      return;
    }

    onSaved?.();
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editingCourt ? "Sửa sân" : "Thêm sân"}</DialogTitle>
      <DialogContent>
        {formError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError}
          </Alert>
        )}
        <TextField
          label="Tên sân"
          fullWidth
          margin="normal"
          value={courtName}
          onChange={(event) => setCourtName(event.target.value)}
        />
        <TextField
          label="Số sân (tuỳ chọn)"
          fullWidth
          margin="normal"
          type="number"
          value={courtNumber}
          onChange={(event) => setCourtNumber(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Hủy</Button>
        <Button variant="contained" onClick={handleSave}>
          Lưu
        </Button>
      </DialogActions>
    </Dialog>
  );
}
