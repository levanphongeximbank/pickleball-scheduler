import { useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  TextField,
  Typography,
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
  validateCourtLimitBulk,
  createCourtsBulk,
  buildBulkCourtRecords,
  getCourtCapacityForClub,
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
  const courtCapacity = useMemo(
    () => getCourtCapacityForClub(targetClubId),
    [targetClubId, open]
  );

  const [tab, setTab] = useState("single");
  const [courtName, setCourtName] = useState("");
  const [courtNumber, setCourtNumber] = useState("");
  const [bulkCourtCount, setBulkCourtCount] = useState("3");
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTab(editingCourt ? "single" : "single");
    setCourtName(editingCourt?.name || "");
    setCourtNumber(editingCourt?.number ?? "");
    setBulkCourtCount(String(courtCapacity?.remaining ?? 3));
    setFormError(null);
  }, [open, editingCourt, courtCapacity?.remaining]);

  const bulkPreview = useMemo(() => {
    const courts = loadCourts([], targetClubId);
    const count = Number(bulkCourtCount);
    if (!Number.isFinite(count) || count < 1) {
      return [];
    }
    return buildBulkCourtRecords(courts, count).map((court) => court.name);
  }, [bulkCourtCount, targetClubId, open]);

  const handleSaveSingle = () => {
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

  const handleSaveBulk = () => {
    const count = Number(bulkCourtCount);
    if (!Number.isFinite(count) || count < 1) {
      setFormError("Vui lòng nhập số sân hợp lệ (từ 1 trở lên).");
      return;
    }

    const limitError = validateCourtLimitBulk(targetClubId, count);
    if (limitError) {
      setFormError(limitError);
      return;
    }

    if (!canCreate) {
      setFormError("Không có quyền thêm sân.");
      return;
    }

    const courts = loadCourts([], targetClubId);
    const updatedCourts = createCourtsBulk(courts, count);
    const result = saveCourts(updatedCourts, targetClubId, {
      permission: PERMISSIONS.COURT_CREATE,
    });
    if (!result.ok) {
      setFormError(result.error || "Không thể lưu sân.");
      return;
    }

    onSaved?.();
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editingCourt ? "Sửa sân" : "Quản lý sân nhanh"}</DialogTitle>
      <DialogContent>
        {formError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError}
          </Alert>
        )}

        {!editingCourt && (
          <Tabs value={tab} onChange={(_event, value) => setTab(value)} sx={{ mb: 2 }}>
            <Tab value="single" label="Thêm từng sân" />
            <Tab value="bulk" label="Tạo nhanh" />
          </Tabs>
        )}

        {(editingCourt || tab === "single") && (
          <Box>
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
          </Box>
        )}

        {!editingCourt && tab === "bulk" && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Nhập số sân tại cơ sở (2, 3, 4, 6...). Hệ thống tạo Sân 1, Sân 2, ...
            </Typography>
            <TextField
              label="Số sân tại cơ sở"
              fullWidth
              type="number"
              inputProps={{
                min: 1,
                max: courtCapacity?.remaining ?? undefined,
              }}
              value={bulkCourtCount}
              onChange={(event) => setBulkCourtCount(event.target.value)}
            />
            {bulkPreview.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Sẽ tạo: {bulkPreview.join(", ")}
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Hủy</Button>
        {!editingCourt && tab === "bulk" ? (
          <Button variant="contained" onClick={handleSaveBulk}>
            Tạo {bulkCourtCount || 0} sân
          </Button>
        ) : (
          <Button variant="contained" onClick={handleSaveSingle}>
            Lưu
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
