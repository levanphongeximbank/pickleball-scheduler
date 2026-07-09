import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { ROLES, normalizeRole } from "../../auth/roles.js";
import GovernanceMemberSelect from "../../components/club/GovernanceMemberSelect.jsx";
import { listClustersForVenue } from "../../features/court-cluster/services/courtClusterService.js";
import {
  cacheRegisterableClusterLocally,
  listRegisterableClusters,
} from "../../features/court-cluster/services/courtClusterDiscoveryService.js";
import { CLUB_STATUSES, listClubGovernanceCandidates, canSelfRegisterClub } from "../../features/club/index.js";
import { createClub, updateClub } from "../../features/club/index.js";

const SEARCH_DEBOUNCE_MS = 300;

const defaultForm = {
  name: "",
  code: "",
  description: "",
  status: CLUB_STATUSES.ACTIVE,
  presidentUserId: "",
  vicePresidentUserId: "",
  registeredClusterId: "",
  assignOwnerToCreator: true,
};

function clusterSearchLabel(cluster) {
  return cluster?.name || cluster?.id || "";
}

function clusterSearchSubtitle(cluster) {
  const venue = cluster?.venueName || cluster?.venueId || "";
  const address = cluster?.address || "";
  return [venue, address].filter(Boolean).join(" · ");
}

export default function ClubFormDialog({
  open,
  club,
  tenantId,
  initialRegisteredClusterId = "",
  lockRegisteredCluster = false,
  onClose,
  onSuccess,
}) {
  const { user } = useAuth();
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [clusterOptions, setClusterOptions] = useState([]);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [clusterSearchInput, setClusterSearchInput] = useState("");
  const [clusterSearch, setClusterSearch] = useState("");
  const [clusterLoading, setClusterLoading] = useState(false);

  const isEdit = Boolean(club?.id);
  const isCourtOwner = normalizeRole(user?.role) === ROLES.TENANT_OWNER;
  const isSelfRegister = canSelfRegisterClub(user);

  const localVenueClusters = useMemo(
    () => (tenantId ? listClustersForVenue(tenantId) : []),
    [tenantId, open]
  );

  const useCloudClusterPicker = !isEdit && (localVenueClusters.length === 0 || isSelfRegister);

  const governanceCandidates = useMemo(
    () => (isEdit && club?.id ? listClubGovernanceCandidates(club.id, tenantId) : []),
    [isEdit, club?.id, tenantId]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setClusterSearch(clusterSearchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [clusterSearchInput]);

  const loadClusterOptions = useCallback(async () => {
    if (!open || isEdit) {
      return;
    }

    if (!useCloudClusterPicker) {
      setClusterOptions(localVenueClusters);
      return;
    }

    setClusterLoading(true);
    const result = await listRegisterableClusters({ search: clusterSearch });
    setClusterLoading(false);

    if (!result.ok) {
      setClusterOptions(localVenueClusters);
      return;
    }

    let options = result.clusters || [];
    if (tenantId) {
      options = options.filter((cluster) => cluster.venueId === tenantId);
    }
    if (options.length === 0 && localVenueClusters.length > 0) {
      options = localVenueClusters;
    }
    setClusterOptions(options);
  }, [open, isEdit, useCloudClusterPicker, clusterSearch, tenantId, localVenueClusters]);

  useEffect(() => {
    void loadClusterOptions();
  }, [loadClusterOptions]);

  useEffect(() => {
    if (!open) return;
    if (club) {
      setForm({
        name: club.name || "",
        code: club.code || "",
        description: club.description || "",
        status: club.status || CLUB_STATUSES.ACTIVE,
        presidentUserId: club.governance?.presidentUserId || "",
        vicePresidentUserId: club.governance?.vicePresidentUserId || "",
        registeredClusterId: club.governance?.registeredClusterId || "",
        assignOwnerToCreator: true,
      });
      const existing = localVenueClusters.find(
        (item) => item.id === club.governance?.registeredClusterId
      );
      setSelectedCluster(existing || null);
    } else {
      const clusterId = String(initialRegisteredClusterId || "").trim();
      setForm({
        ...defaultForm,
        presidentUserId: isSelfRegister ? user?.id || "" : "",
        registeredClusterId: clusterId,
        assignOwnerToCreator: isCourtOwner,
      });
      setSelectedCluster(null);
    }
    setError(null);
  }, [open, club, user, isSelfRegister, isCourtOwner, initialRegisteredClusterId, localVenueClusters]);

  useEffect(() => {
    if (!open || isEdit || !initialRegisteredClusterId) {
      return;
    }

    const match =
      clusterOptions.find((item) => item.id === initialRegisteredClusterId) ||
      localVenueClusters.find((item) => item.id === initialRegisteredClusterId);

    if (match) {
      setSelectedCluster(match);
      setForm((prev) => ({ ...prev, registeredClusterId: match.id }));
    }
  }, [open, isEdit, initialRegisteredClusterId, clusterOptions, localVenueClusters]);

  const handleClusterChange = (_event, value) => {
    setSelectedCluster(value);
    setForm((prev) => ({
      ...prev,
      registeredClusterId: value?.id || "",
    }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    const presidentUserId = form.presidentUserId.trim() || (isSelfRegister ? user?.id : "");
    if (!isEdit && !presidentUserId) {
      setSaving(false);
      setError("Chủ tịch CLB bắt buộc — nhập user ID Chủ tịch.");
      return;
    }

    const registeredClusterId = form.registeredClusterId.trim() || null;
    if (registeredClusterId && selectedCluster) {
      const cacheResult = await cacheRegisterableClusterLocally(selectedCluster);
      if (!cacheResult.ok) {
        setSaving(false);
        setError(cacheResult.error || "Không lưu được cụm sân đã chọn.");
        return;
      }
    }

    const governance = {
      presidentUserId: presidentUserId || club?.governance?.presidentUserId,
      ownerUserId: club?.governance?.ownerUserId ?? null,
      vicePresidentUserId: form.vicePresidentUserId.trim() || null,
      registeredClusterId,
    };

    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      description: form.description.trim(),
      status: form.status,
      tenantId,
      assignOwnerToCreator: form.assignOwnerToCreator,
      governance,
    };

    const result = isEdit
      ? updateClub(club.id, payload, tenantId)
      : createClub(payload);

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSuccess?.(result.club);
  };

  const clusterPickerOptions = useCloudClusterPicker ? clusterOptions : localVenueClusters;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? "Chỉnh sửa CLB" : "Tạo CLB mới"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {!isEdit && isSelfRegister && (
            <Alert severity="info">
              Bạn sẽ là <strong>Chủ tịch CLB</strong>. CLB hoạt động ngay sau khi tạo.
            </Alert>
          )}
          <TextField
            label="Tên CLB"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            error={Boolean(error && !form.name.trim())}
          />
          <TextField
            label="Mã CLB"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            helperText="Tùy chọn — không trùng trong cùng tenant"
          />
          <TextField
            label="Mô tả"
            multiline
            minRows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          {!isEdit && (
            <TextField
              label="User ID Chủ tịch"
              required
              value={form.presidentUserId}
              onChange={(e) => setForm((f) => ({ ...f, presidentUserId: e.target.value }))}
              helperText={
                isSelfRegister
                  ? "Mặc định là tài khoản của bạn"
                  : "Bắt buộc — auth user id của Chủ tịch CLB"
              }
              disabled={isSelfRegister}
            />
          )}
          {isEdit ? (
            <>
              <GovernanceMemberSelect
                label="Phó chủ tịch"
                value={form.vicePresidentUserId}
                onChange={(value) => setForm((f) => ({ ...f, vicePresidentUserId: value }))}
                candidates={governanceCandidates.filter(
                  (item) =>
                    item.userId !== (form.presidentUserId || club?.governance?.presidentUserId)
                )}
                allowEmpty
                emptyLabel="Không có"
              />
              <Typography variant="caption" color="text.secondary">
                Phó chủ tịch phải là vận động viên trong danh sách CLB.
              </Typography>
            </>
          ) : (
            <TextField
              label="User ID Phó chủ tịch"
              value={form.vicePresidentUserId}
              onChange={(e) => setForm((f) => ({ ...f, vicePresidentUserId: e.target.value }))}
              helperText="Tùy chọn — gán sau khi CLB có vận động viên"
            />
          )}
          {lockRegisteredCluster && selectedCluster ? (
            <TextField
              label="Cụm sân đăng ký"
              value={clusterSearchLabel(selectedCluster)}
              helperText={clusterSearchSubtitle(selectedCluster)}
              disabled
              fullWidth
            />
          ) : (
            <Autocomplete
              options={clusterPickerOptions}
              value={selectedCluster}
              onChange={handleClusterChange}
              inputValue={clusterSearchInput}
              onInputChange={(_event, value) => setClusterSearchInput(value)}
              getOptionLabel={clusterSearchLabel}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              loading={clusterLoading}
              disabled={lockRegisteredCluster}
              noOptionsText={
                clusterLoading
                  ? "Đang tải..."
                  : clusterSearch
                    ? "Không tìm thấy cụm sân"
                    : "Gõ tên cụm sân để tìm"
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Cụm sân đăng ký"
                  placeholder="Tùy chọn — tìm theo tên cụm sân"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {clusterLoading ? <CircularProgress color="inherit" size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, cluster) => (
                <li {...props} key={cluster.id}>
                  <Box>
                    <Typography variant="body2">{clusterSearchLabel(cluster)}</Typography>
                    {clusterSearchSubtitle(cluster) && (
                      <Typography variant="caption" color="text.secondary">
                        {clusterSearchSubtitle(cluster)}
                      </Typography>
                    )}
                  </Box>
                </li>
              )}
            />
          )}
          {!isEdit && isCourtOwner && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.assignOwnerToCreator}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, assignOwnerToCreator: e.target.checked }))
                  }
                />
              }
              label="Tôi là Chủ sở hữu CLB"
            />
          )}
          {isEdit && (
            <TextField
              select
              label="Trạng thái"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <MenuItem value={CLUB_STATUSES.ACTIVE}>Đang hoạt động</MenuItem>
              <MenuItem value={CLUB_STATUSES.PENDING_SETUP}>Chờ thiết lập</MenuItem>
              <MenuItem value={CLUB_STATUSES.PENDING_APPROVAL}>Chờ chủ sân duyệt</MenuItem>
              <MenuItem value={CLUB_STATUSES.INACTIVE}>Vô hiệu hóa</MenuItem>
            </TextField>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button variant="contained" onClick={() => void handleSubmit()} disabled={saving || !form.name.trim()}>
          {saving ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo CLB"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
