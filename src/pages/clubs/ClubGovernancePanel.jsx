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
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

import { useAuth } from "../../context/AuthContext.jsx";
import GovernanceMemberSelect from "../../components/club/GovernanceMemberSelect.jsx";
import { listClustersForVenue } from "../../features/court-cluster/services/courtClusterService.js";
import {
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
} from "@mui/material";
import {
  canAssignClubOwner,
  canChangeClubPresident,
  canManageClubGovernance,
  getGovernanceDisplayLabels,
  getRegisteredClusterLabel,
  listClubGovernanceCandidates,
  updateClubGovernance,
  assignClubOwner,
  assignClubVicePresident,
  transferClubPresident,
} from "../../features/club/index.js";

export default function ClubGovernancePanel({ club, tenantId, onRefresh }) {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    presidentUserId: "",
    vicePresidentUserId: "",
    ownerUserId: "",
    registeredClusterId: "",
  });

  const labels = useMemo(
    () => getGovernanceDisplayLabels(club, tenantId),
    [club, tenantId]
  );
  const registeredCluster = useMemo(
    () => getRegisteredClusterLabel(club, tenantId),
    [club, tenantId]
  );

  const venueClusters = useMemo(
    () => listClustersForVenue(tenantId),
    [tenantId]
  );

  const candidates = useMemo(
    () => listClubGovernanceCandidates(club.id, tenantId),
    [club.id, tenantId]
  );

  const canEdit = canManageClubGovernance(user, club);
  const canAssignOwner = canAssignClubOwner(user);
  const canChangePresident = canChangeClubPresident(user, club);

  const openEdit = () => {
    setForm({
      presidentUserId: club.governance?.presidentUserId || "",
      vicePresidentUserId: club.governance?.vicePresidentUserId || "",
      ownerUserId: club.governance?.ownerUserId || "",
      registeredClusterId: club.governance?.registeredClusterId || "",
    });
    setError(null);
    setEditOpen(true);
  };

  const handleSave = async () => {
    setError(null);

    const currentPresident = club.governance?.presidentUserId || "";
    const currentVice = club.governance?.vicePresidentUserId || "";
    const currentCluster = club.governance?.registeredClusterId || "";
    const nextPresident = form.presidentUserId.trim();
    const nextVice = form.vicePresidentUserId.trim();
    const nextCluster = form.registeredClusterId.trim();

    if (canChangePresident && nextPresident !== currentPresident) {
      const presResult = await transferClubPresident(
        club.id,
        nextPresident,
        tenantId
      );
      if (!presResult.ok) {
        setError(presResult.error);
        return;
      }
    }

    if (nextVice !== currentVice) {
      const viceResult = await assignClubVicePresident(
        club.id,
        nextVice || null,
        tenantId
      );
      if (!viceResult.ok) {
        setError(viceResult.error);
        return;
      }
    }

    if (nextCluster !== currentCluster) {
      const govResult = updateClubGovernance(
        club.id,
        { registeredClusterId: nextCluster || null },
        tenantId
      );
      if (!govResult.ok) {
        setError(govResult.error);
        return;
      }
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
          {!registeredCluster ? (
            <Typography variant="body2" color="text.secondary">
              Chưa đăng ký cụm sân
            </Typography>
          ) : (
            <Chip
              size="small"
              label={registeredCluster.name}
              title={registeredCluster.address || undefined}
            />
          )}
        </Box>
      </Stack>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Chỉnh sửa quản trị CLB</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <GovernanceMemberSelect
              label="Chủ tịch"
              value={form.presidentUserId}
              onChange={(value) => setForm((f) => ({ ...f, presidentUserId: value }))}
              candidates={candidates}
              disabled={!canChangePresident}
              required
            />
            {!canChangePresident && (
              <Typography variant="caption" color="text.secondary">
                Chỉ Chủ sở hữu CLB hoặc chủ sân được đổi Chủ tịch
              </Typography>
            )}
            <GovernanceMemberSelect
              label="Phó chủ tịch"
              value={form.vicePresidentUserId}
              onChange={(value) => setForm((f) => ({ ...f, vicePresidentUserId: value }))}
              candidates={candidates.filter(
                (item) => item.userId !== form.presidentUserId
              )}
              allowEmpty
              emptyLabel="Không có"
            />
            <Typography variant="caption" color="text.secondary">
              Chủ tịch / Phó chủ tịch phải là vận động viên trong danh sách CLB.
            </Typography>
            {canAssignOwner && (
              <GovernanceMemberSelect
                label="Chủ sở hữu"
                value={form.ownerUserId}
                onChange={(value) => setForm((f) => ({ ...f, ownerUserId: value }))}
                candidates={candidates}
                allowEmpty
                emptyLabel="Chưa gán"
              />
            )}
            {canAssignOwner && (
              <Typography variant="caption" color="text.secondary">
                Chỉ chủ sân được gán Chủ sở hữu
              </Typography>
            )}
            <FormControl fullWidth>
              <InputLabel>Cụm sân đăng ký</InputLabel>
              <Select
                value={form.registeredClusterId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    registeredClusterId: e.target.value,
                  }))
                }
                label="Cụm sân đăng ký"
                displayEmpty
              >
                <MenuItem value="">
                  <em>Chưa chọn</em>
                </MenuItem>
                {venueClusters.length === 0 && (
                  <MenuItem disabled>Chưa có cụm sân trong tổ chức</MenuItem>
                )}
                {venueClusters.map((cluster) => (
                  <MenuItem key={cluster.id} value={cluster.id}>
                    <ListItemText
                      primary={cluster.name || cluster.id}
                      secondary={cluster.address || undefined}
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
