import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

import { useAuth } from "../../../context/AuthContext.jsx";
import GovernanceMemberSelect from "../../../components/club/GovernanceMemberSelect.jsx";
import {
  canAssignClubOwner,
  canChangeClubPresident,
  canDeleteClub,
  canManageClubGovernance,
  canTransferClubOwnership,
  deleteClubAsOwner,
  fetchGovernanceNameHints,
  getClubById,
  getGovernanceDisplayLabels,
  getRegisteredClusterLabel,
  getVicePresidentUserIds,
  isClubStorageV2Enabled,
  listClubGovernanceCandidatesAsync,
  setClubVicePresidents,
  transferClubOwnership,
  transferClubPresident,
  updateClubGovernance,
} from "../../../features/club/index.js";
import { listClustersForVenue } from "../../../features/court-cluster/services/courtClusterService.js";

function mapGovernanceError(result) {
  const serverCode = String(result?.serverCode || "").trim();
  if (serverCode === "VERSION_CONFLICT") {
    return "Dữ liệu CLB đã thay đổi trên máy chủ. Vui lòng tải lại rồi thử lại.";
  }
  if (serverCode === "FORBIDDEN") {
    return result?.error || "Bạn không có quyền chỉnh sửa quản trị CLB.";
  }
  return result?.error || "Không cập nhật được quản trị CLB.";
}

export default function MyClubGovernancePanel({
  clubId,
  tenantId,
  clubRecord: clubRecordProp = null,
  revision = 0,
  onRefresh,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nameHints, setNameHints] = useState({});
  const [candidates, setCandidates] = useState([]);
  const [nextPresidentId, setNextPresidentId] = useState("");
  const [nextOwnerId, setNextOwnerId] = useState("");
  const [vicePresidentIds, setVicePresidentIds] = useState(["", ""]);
  const [registeredClusterId, setRegisteredClusterId] = useState("");

  const club = useMemo(() => {
    if (clubRecordProp?.id === clubId) {
      return clubRecordProp;
    }
    if (isClubStorageV2Enabled()) {
      return clubRecordProp || null;
    }
    return getClubById(clubId, tenantId);
  }, [clubRecordProp, clubId, tenantId, revision]);

  useEffect(() => {
    if (!club) return;
    const viceIds = getVicePresidentUserIds(club.governance);
    setVicePresidentIds([viceIds[0] || "", viceIds[1] || ""]);
    setRegisteredClusterId(club.governance?.registeredClusterId || "");
  }, [
    club?.id,
    club?.governance?.vicePresidentUserId,
    club?.governance?.vicePresidentUserIds,
    club?.governance?.registeredClusterId,
    revision,
  ]);

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
    revision,
  ]);

  useEffect(() => {
    let cancelled = false;
    void listClubGovernanceCandidatesAsync(clubId, tenantId).then((rows) => {
      if (!cancelled) {
        setCandidates(rows);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [clubId, tenantId, revision]);

  const labels = useMemo(
    () => (club ? getGovernanceDisplayLabels(club, tenantId, nameHints) : null),
    [club, tenantId, nameHints]
  );
  const registeredCluster = useMemo(
    () => (club ? getRegisteredClusterLabel(club, tenantId) : null),
    [club, tenantId]
  );
  const venueClusters = useMemo(() => listClustersForVenue(tenantId), [tenantId]);

  if (!club) {
    return null;
  }

  const canManage = canManageClubGovernance(user, club);
  const canAssignOwner = canAssignClubOwner(user);
  const canChangePresident = canChangeClubPresident(user, club);
  const canTransferOwner = canTransferClubOwnership(user, club);
  const canDelete = canDeleteClub(user, club);

  if (!canManage && !canDelete) {
    return null;
  }

  const handleTransferPresident = async () => {
    setBusy(true);
    setError(null);
    const result = await transferClubPresident(clubId, nextPresidentId, tenantId);
    setBusy(false);
    if (!result.ok) {
      setError(mapGovernanceError(result));
      onRefresh?.();
      return;
    }
    setMessage({ type: "success", text: "Đã chuyển Chủ tịch CLB." });
    setNextPresidentId("");
    onRefresh?.();
  };

  const handleTransferOwner = () => {
    setBusy(true);
    setError(null);
    const result = transferClubOwnership(clubId, nextOwnerId, tenantId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage({ type: "success", text: "Đã chuyển quyền sở hữu CLB." });
    setNextOwnerId("");
    onRefresh?.();
  };

  const handleSaveGovernance = async () => {
    setBusy(true);
    setError(null);

    const currentViceIds = getVicePresidentUserIds(club.governance);
    const nextViceIds = vicePresidentIds.map((id) => String(id || "").trim()).filter(Boolean);
    const currentCluster = club.governance?.registeredClusterId || "";
    const nextCluster = registeredClusterId.trim();
    const presidentId = club.governance?.presidentUserId || "";

    if (nextViceIds.includes(presidentId)) {
      setBusy(false);
      setError("Chủ tịch không thể đồng thời là Phó chủ tịch.");
      return;
    }

    const viceChanged =
      currentViceIds.length !== nextViceIds.length ||
      currentViceIds.some((id, index) => String(id) !== String(nextViceIds[index] || ""));

    if (viceChanged) {
      const viceResult = await setClubVicePresidents(clubId, nextViceIds, tenantId);
      if (!viceResult.ok) {
        setBusy(false);
        setError(mapGovernanceError(viceResult));
        onRefresh?.();
        return;
      }
    }

    if (nextCluster !== currentCluster) {
      const clusterResult = updateClubGovernance(
        clubId,
        { registeredClusterId: nextCluster || null },
        tenantId
      );
      if (!clusterResult.ok) {
        setBusy(false);
        setError(clusterResult.error);
        return;
      }
    }

    setBusy(false);
    setMessage({ type: "success", text: "Đã cập nhật quản trị CLB." });
    onRefresh?.();
  };

  const handleDeleteClub = () => {
    setBusy(true);
    setError(null);
    const result = deleteClubAsOwner(clubId, tenantId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDeleteOpen(false);
    navigate("/my-club", { replace: true });
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Quản trị CLB
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Chủ sở hữu:</strong> {labels?.ownerLabel}
        </Typography>
        {!labels?.combinedOwnerPresident && labels?.presidentLabel && (
          <Typography variant="body2">
            <strong>Chủ tịch:</strong> {labels.presidentLabel}
          </Typography>
        )}
        {[0, 1].map((index) => (
          <Typography key={index} variant="body2">
            <strong>Phó chủ tịch {index + 1}:</strong>{" "}
            {(labels?.vicePresidentLabels || [])[index] || "—"}
          </Typography>
        ))}
        {club.version != null && (
          <Typography variant="caption" color="text.secondary">
            Phiên bản CLB: {club.version}
          </Typography>
        )}
        {registeredCluster && (
          <Typography variant="body2" color="text.secondary">
            Cụm sân: {registeredCluster.name}
          </Typography>
        )}
      </Stack>

      {canManage && (
        <Stack spacing={2}>
          {[0, 1].map((index) => (
            <GovernanceMemberSelect
              key={index}
              label={`Phó chủ tịch ${index + 1}`}
              value={vicePresidentIds[index] || ""}
              onChange={(value) =>
                setVicePresidentIds((prev) => {
                  const next = [...prev];
                  next[index] = value;
                  return next;
                })
              }
              candidates={candidates.filter(
                (item) =>
                  item.userId !== club.governance?.presidentUserId &&
                  !vicePresidentIds.some(
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
            <Button size="small" onClick={() => setVicePresidentIds(["", ""])}>
              Xóa hết Phó CT
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Tối đa 2 Phó chủ tịch; phải là thành viên đang hoạt động trong CLB.
          </Typography>

          <FormControl fullWidth>
            <InputLabel>Cụm sân đăng ký</InputLabel>
            <Select
              value={registeredClusterId || club.governance?.registeredClusterId || ""}
              onChange={(event) => setRegisteredClusterId(event.target.value)}
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

          <Button variant="outlined" onClick={handleSaveGovernance} disabled={busy}>
            Lưu thông tin quản trị
          </Button>

          {canChangePresident && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="stretch">
              <Box sx={{ flex: 1 }}>
                <GovernanceMemberSelect
                  label="Chuyển Chủ tịch cho"
                  value={nextPresidentId}
                  onChange={setNextPresidentId}
                  candidates={candidates.filter(
                    (item) => item.userId !== club.governance?.presidentUserId
                  )}
                  allowEmpty
                />
              </Box>
              <Button
                variant="contained"
                startIcon={<SwapHorizIcon />}
                onClick={handleTransferPresident}
                disabled={busy || !nextPresidentId}
                sx={{ alignSelf: { sm: "flex-end" }, minWidth: 160 }}
              >
                Chuyển Chủ tịch
              </Button>
            </Stack>
          )}

          {canTransferOwner && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="stretch">
              <Box sx={{ flex: 1 }}>
                <GovernanceMemberSelect
                  label="Chuyển quyền sở hữu cho"
                  value={nextOwnerId}
                  onChange={setNextOwnerId}
                  candidates={candidates.filter(
                    (item) => item.userId !== club.governance?.ownerUserId
                  )}
                  allowEmpty
                />
              </Box>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<SwapHorizIcon />}
                onClick={handleTransferOwner}
                disabled={busy || !nextOwnerId}
                sx={{ alignSelf: { sm: "flex-end" }, minWidth: 180 }}
              >
                Chuyển sở hữu
              </Button>
            </Stack>
          )}

          {canAssignOwner && (
            <Alert severity="info">
              Chủ sân có thể gán Chủ sở hữu qua trang Danh sách CLB.
            </Alert>
          )}
        </Stack>
      )}

      {canDelete && (
        <Box sx={{ mt: 2 }}>
          <Button
            color="error"
            variant="outlined"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteOpen(true)}
            disabled={busy}
          >
            Xóa CLB
          </Button>
        </Box>
      )}

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Xóa CLB {club.name}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Thao tác này xóa CLB và dữ liệu liên quan trên thiết bị này. Không thể hoàn tác.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Hủy</Button>
          <Button color="error" variant="contained" onClick={handleDeleteClub} disabled={busy}>
            Xóa CLB
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
