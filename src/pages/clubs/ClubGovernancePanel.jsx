import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

import { useAuth } from "../../context/AuthContext.jsx";
import { loadCourtsForVenueScoped } from "../../domain/courtService.js";
import {
  canAssignClubOwner,
  canManageClubGovernance,
  getGovernanceDisplayLabels,
  getRegisteredCourtsLabels,
  updateClubGovernance,
  assignClubOwner,
} from "../../features/club/index.js";

export default function ClubGovernancePanel({ club, tenantId, onRefresh }) {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    presidentUserId: "",
    vicePresidentUserId: "",
    ownerUserId: "",
    registeredCourtIds: [],
  });

  const labels = useMemo(() => getGovernanceDisplayLabels(club), [club]);
  const registeredCourts = useMemo(
    () => getRegisteredCourtsLabels(club, tenantId),
    [club, tenantId]
  );

  const venueCourts = useMemo(
    () => loadCourtsForVenueScoped(tenantId, tenantId),
    [tenantId]
  );

  const canEdit = canManageClubGovernance(user, club);
  const canAssignOwner = canAssignClubOwner(user);

  const openEdit = () => {
    setForm({
      presidentUserId: club.governance?.presidentUserId || "",
      vicePresidentUserId: club.governance?.vicePresidentUserId || "",
      ownerUserId: club.governance?.ownerUserId || "",
      registeredCourtIds: club.governance?.registeredCourtIds || [],
    });
    setError(null);
    setEditOpen(true);
  };

  const handleSave = () => {
    setError(null);

    const govResult = updateClubGovernance(club.id, {
      presidentUserId: form.presidentUserId.trim() || null,
      vicePresidentUserId: form.vicePresidentUserId.trim() || null,
      registeredCourtIds: form.registeredCourtIds,
    });

    if (!govResult.ok) {
      setError(govResult.error);
      return;
    }

    if (canAssignOwner && form.ownerUserId.trim() !== (club.governance?.ownerUserId || "")) {
      const ownerResult = assignClubOwner(
        club.id,
        form.ownerUserId.trim() || null,
        tenantId
      );
      if (!ownerResult.ok) {
        setError(ownerResult.error);
        return;
      }
    }

    setEditOpen(false);
    onRefresh?.();
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle1" fontWeight={600}>
          Quản trị CLB
        </Typography>
        {canEdit && (
          <Button size="small" startIcon={<EditIcon />} onClick={openEdit}>
            Chỉnh sửa
          </Button>
        )}
      </Stack>

      <Stack spacing={0.5}>
        <Typography variant="body2">
          <strong>Chủ sở hữu:</strong> {labels.combinedOwnerPresident ? labels.ownerLabel : labels.ownerLabel}
        </Typography>
        {!labels.combinedOwnerPresident && labels.presidentLabel && (
          <Typography variant="body2">
            <strong>Chủ tịch:</strong> {labels.presidentLabel}
          </Typography>
        )}
        <Typography variant="body2">
          <strong>Phó chủ tịch:</strong> {labels.vicePresidentLabel}
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Cụm sân đăng ký hoạt động
          </Typography>
          {registeredCourts.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Chưa đăng ký sân
            </Typography>
          ) : (
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {registeredCourts.map((court) => (
                <Chip
                  key={court.id}
                  size="small"
                  label={`${court.name}${court.clubName ? ` (${court.clubName})` : ""}`}
                />
              ))}
            </Stack>
          )}
        </Box>
      </Stack>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Chỉnh sửa quản trị CLB</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="User ID Chủ tịch"
              required
              fullWidth
              value={form.presidentUserId}
              onChange={(e) => setForm((f) => ({ ...f, presidentUserId: e.target.value }))}
            />
            <TextField
              label="User ID Phó chủ tịch"
              fullWidth
              value={form.vicePresidentUserId}
              onChange={(e) => setForm((f) => ({ ...f, vicePresidentUserId: e.target.value }))}
            />
            {canAssignOwner && (
              <TextField
                label="User ID Chủ sở hữu"
                fullWidth
                value={form.ownerUserId}
                onChange={(e) => setForm((f) => ({ ...f, ownerUserId: e.target.value }))}
                helperText="Chỉ chủ sân được gán Chủ sở hữu"
              />
            )}
            <FormControl fullWidth>
              <InputLabel>Cụm sân đăng ký</InputLabel>
              <Select
                multiple
                value={form.registeredCourtIds}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    registeredCourtIds:
                      typeof e.target.value === "string"
                        ? e.target.value.split(",")
                        : e.target.value,
                  }))
                }
                input={<OutlinedInput label="Cụm sân đăng ký" />}
                renderValue={(selected) =>
                  selected
                    .map((id) => venueCourts.find((c) => c.id === id)?.name || id)
                    .join(", ")
                }
              >
                {venueCourts.length === 0 && (
                  <MenuItem disabled>Chưa có sân trong venue</MenuItem>
                )}
                {venueCourts.map((court) => (
                  <MenuItem key={court.id} value={court.id}>
                    <ListItemText
                      primary={court.name || court.id}
                      secondary={court.clubName ? `CLB: ${court.clubName}` : undefined}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSave}>
            Lưu
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
