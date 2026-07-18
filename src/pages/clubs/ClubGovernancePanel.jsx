import { useEffect, useMemo, useState } from "react";
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
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

import { useAuth } from "../../context/AuthContext.jsx";
import GovernanceMemberSelect from "../../components/club/GovernanceMemberSelect.jsx";
import { listClustersForVenue } from "../../features/court-cluster/services/courtClusterService.js";
import {
  canAssignClubOwner,
  canChangeClubPresident,
  canManageClubGovernance,
  fetchGovernanceNameHints,
  getGovernanceDisplayLabels,
  getRegisteredClusterLabel,
  getVicePresidentUserIds,
  listClubGovernanceCandidatesAsync,
  updateClubGovernance,
  assignClubOwner,
  setClubVicePresidents,
  transferClubPresident,
} from "../../features/club/index.js";

function mapGovernanceError(result) {
  const serverCode = String(result?.serverCode || "").trim();
  if (serverCode === "VERSION_CONFLICT") {
    return "Dữ liệu CLB đã thay đổi trên máy chủ. Vui lòng tải lại rồi thử lại.";
  }
  if (serverCode === "FORBIDDEN" || result?.code === "FORBIDDEN") {
    return result?.error || "Bạn không có quyền chỉnh sửa quản trị CLB.";
  }
  return result?.error || "Không cập nhật được quản trị CLB.";
}

export default function ClubGovernancePanel({ club, tenantId, onRefresh }) {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState(null);
  const [nameHints, setNameHints] = useState({});
  const [candidates, setCandidates] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    presidentUserId: "",
    vicePresidentIds: ["", ""],
    ownerUserId: "",
    registeredClusterId: "",
  });

  useEffect(() => {
    let cancelled = false;
    const gov = club?.governance || {};
    const ids = [
      gov.presidentUserId,
      gov.ownerUserId,
      ...getVicePresidentUserIds(gov),
    ].filter(Boolean);

    void fetchGovernanceNameHints(ids).then((hints) => {
      if (!cancelled) {
        setNameHints(hints);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    club?.id,
    club?.governance?.presidentUserId,
    club?.governance?.ownerUserId,
    club?.governance?.vicePresidentUserId,
    club?.governance?.vicePresidentUserIds,
  ]);

  useEffect(() => {
    let cancelled = false;
    void listClubGovernanceCandidatesAsync(club.id, tenantId).then((rows) => {
      if (!cancelled) {
        setCandidates(rows);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [club.id, tenantId, club?.governance?.presidentUserId, club?.governance?.vicePresidentUserIds]);

  const labels = useMemo(
    () => getGovernanceDisplayLabels(club, tenantId, nameHints),
    [club, tenantId, nameHints]
  );
  const registeredCluster = useMemo(
    () => getRegisteredClusterLabel(club, tenantId),
    [club, tenantId]
  );

  const venueClusters = useMemo(
    () => listClustersForVenue(tenantId),
    [tenantId]
  );

  const canEdit = canManageClubGovernance(user, club);
  const canAssignOwner = canAssignClubOwner(user);
  const canChangePresident = canChangeClubPresident(user, club);
  const viceLabels = labels.vicePresidentLabels || [];

  const openEdit = () => {
    const viceIds = getVicePresidentUserIds(club.governance);
    setForm({
      presidentUserId: club.governance?.presidentUserId || "",
      vicePresidentIds: [viceIds[0] || "", viceIds[1] || ""],
      ownerUserId: club.governance?.ownerUserId || "",
      registeredClusterId: club.governance?.registeredClusterId || "",
    });
    setError(null);
    setEditOpen(true);
  };

  const handleSave = async () => {
    setError(null);
    setBusy(true);

    const currentPresident = club.governance?.presidentUserId || "";
    const currentViceIds = getVicePresidentUserIds(club.governance);
    const currentCluster = club.governance?.registeredClusterId || "";
    const nextPresident = form.presidentUserId.trim();
    const nextViceIds = form.vicePresidentIds
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    const nextCluster = form.registeredClusterId.trim();

    if (nextViceIds.includes(nextPresident || currentPresident)) {
      setBusy(false);
      setError("Chủ tịch không thể đồng thời là Phó chủ tịch.");
      return;
    }

    if (canChangePresident && nextPresident !== currentPresident) {
      const presResult = await transferClubPresident(club.id, nextPresident, tenantId);
      if (!presResult.ok) {
        setBusy(false);
        setError(mapGovernanceError(presResult));
        return;
      }
    }

    const viceChanged =
      currentViceIds.length !== nextViceIds.length ||
      currentViceIds.some((id, index) => String(id) !== String(nextViceIds[index] || ""));

    if (viceChanged) {
      const viceResult = await setClubVicePresidents(club.id, nextViceIds, tenantId);
      if (!viceResult.ok) {
        setBusy(false);
        setError(mapGovernanceError(viceResult));
        onRefresh?.();
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
        setBusy(false);
        setError(govResult.error);
        return;
      }
    }

    if (canAssignOwner && form.ownerUserId.trim() !== (club.governance?.ownerUserId || "")) {
      const ownerResult = await assignClubOwner(
        club.id,
        form.ownerUserId.trim() || null,
        tenantId
      );
      if (!ownerResult.ok) {
        setBusy(false);
        setError(mapGovernanceError(ownerResult));
        return;
      }
    }

    setBusy(false);
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
          <strong>Chủ sở hữu:</strong>{" "}
          {labels.combinedOwnerPresident ? labels.ownerLabel : labels.ownerLabel}
        </Typography>
        {!labels.combinedOwnerPresident && labels.presidentLabel && (
          <Typography variant="body2">
            <strong>Chủ tịch:</strong> {labels.presidentLabel}
          </Typography>
        )}
        {[0, 1].map((index) => (
          <Typography key={index} variant="body2">
            <strong>Phó chủ tịch {index + 1}:</strong> {viceLabels[index] || "—"}
          </Typography>
        ))}
        {club.version != null && (
          <Typography variant="caption" color="text.secondary">
            Phiên bản CLB: {club.version}
          </Typography>
        )}
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

      <Dialog open={editOpen} onClose={() => !busy && setEditOpen(false)} maxWidth="sm" fullWidth>
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
            />
            {[0, 1].map((index) => (
              <GovernanceMemberSelect
                key={index}
                label={`Phó chủ tịch ${index + 1}`}
                value={form.vicePresidentIds[index] || ""}
                onChange={(value) =>
                  setForm((f) => {
                    const next = [...f.vicePresidentIds];
                    next[index] = value;
                    return { ...f, vicePresidentIds: next };
                  })
                }
                candidates={candidates.filter(
                  (item) =>
                    item.userId !== form.presidentUserId &&
                    item.userId !== club.governance?.presidentUserId &&
                    !form.vicePresidentIds.some(
                      (selectedId, selectedIndex) =>
                        selectedIndex !== index &&
                        selectedId &&
                        selectedId === item.userId
                    )
                )}
                allowEmpty
                emptyLabel="Không có"
              />
            ))}
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                onClick={() =>
                  setForm((f) => ({ ...f, vicePresidentIds: ["", ""] }))
                }
              >
                Xóa hết Phó CT
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Tối đa 2 Phó chủ tịch. Xóa một slot không ảnh hưởng slot còn lại.
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
            <FormControl fullWidth>
              <InputLabel>Cụm sân đăng ký</InputLabel>
              <Select
                value={form.registeredClusterId}
                onChange={(event) =>
                  setForm((f) => ({ ...f, registeredClusterId: event.target.value }))
                }
                label="Cụm sân đăng ký"
                displayEmpty
              >
                <MenuItem value="">
                  <em>Chưa chọn</em>
                </MenuItem>
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
          <Button onClick={() => setEditOpen(false)} disabled={busy}>
            Hủy
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
