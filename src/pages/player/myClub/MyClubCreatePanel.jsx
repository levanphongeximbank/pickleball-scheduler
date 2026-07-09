import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import ClubFormDialog from "../../clubs/ClubFormDialog.jsx";
import { canSelfRegisterClub } from "../../../features/club/index.js";
import {
  cacheRegisterableClusterLocally,
  listRegisterableClusters,
} from "../../../features/court-cluster/services/courtClusterDiscoveryService.js";

const SEARCH_DEBOUNCE_MS = 300;

function clusterSearchLabel(cluster) {
  return cluster?.name || cluster?.id || "";
}

function clusterSearchSubtitle(cluster) {
  const venue = cluster?.venueName || cluster?.venueId || "";
  const address = cluster?.address || "";
  return [venue, address].filter(Boolean).join(" · ");
}

export default function MyClubCreatePanel({ tenantId, user, onSuccess }) {
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [clusters, setClusters] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const effectiveTenantId = tenantId || selectedCluster?.venueId || "";

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadClusters = useCallback(async () => {
    if (tenantId) {
      return;
    }

    setLoading(true);
    setLoadError(null);

    const result = await listRegisterableClusters({ search });
    setLoading(false);

    if (!result.ok) {
      setLoadError(result.error || "Không tải được danh sách cụm sân.");
      setClusters([]);
      return;
    }

    setClusters(result.clusters || []);
  }, [search, tenantId]);

  useEffect(() => {
    void loadClusters();
  }, [loadClusters]);

  const clusterOptions = useMemo(() => clusters, [clusters]);

  if (!canSelfRegisterClub(user)) {
    return (
      <Alert severity="info">
        Tài khoản đã được gán CLB hoặc không có quyền tự đăng ký CLB mới.
      </Alert>
    );
  }

  const handleOpenForm = async () => {
    if (!effectiveTenantId) {
      setMessage({
        type: "warning",
        text: "Vui lòng chọn cụm sân hoạt động trước khi tạo CLB.",
      });
      return;
    }

    if (selectedCluster) {
      await cacheRegisterableClusterLocally(selectedCluster);
    }

    setFormOpen(true);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Bạn có thể tạo CLB mới và trở thành <strong>Chủ tịch CLB</strong>. CLB sẽ{" "}
        <strong>hoạt động ngay</strong> sau khi tạo — bạn có thể thêm thành viên và duyệt yêu cầu
        tham gia.
      </Typography>

      {!tenantId && (
        <Autocomplete
          sx={{ mb: 2, maxWidth: 520 }}
          options={clusterOptions}
          value={selectedCluster}
          onChange={(_event, value) => setSelectedCluster(value)}
          inputValue={searchInput}
          onInputChange={(_event, value) => setSearchInput(value)}
          getOptionLabel={clusterSearchLabel}
          isOptionEqualToValue={(option, value) => option?.id === value?.id}
          loading={loading}
          noOptionsText={
            loading
              ? "Đang tải..."
              : search
                ? "Không tìm thấy cụm sân — thử từ khóa khác"
                : "Gõ tên cụm sân để tìm"
          }
          renderInput={(params) => {
            const autocompleteInputProps = params.InputProps ?? {};

            return (
              <TextField
                {...params}
                label="Cụm sân hoạt động"
                placeholder="Tìm theo tên cụm sân, địa chỉ..."
                InputProps={{
                  ...autocompleteInputProps,
                  endAdornment: (
                    <>
                      {loading ? <CircularProgress color="inherit" size={18} /> : null}
                      {autocompleteInputProps.endAdornment}
                    </>
                  ),
                }}
              />
            );
          }}
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

      {loadError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => void handleOpenForm()}
        disabled={!effectiveTenantId}
      >
        Tạo CLB mới
      </Button>

      <ClubFormDialog
        open={formOpen}
        club={null}
        tenantId={effectiveTenantId}
        initialRegisteredClusterId={selectedCluster?.id || ""}
        lockRegisteredCluster={Boolean(selectedCluster?.id)}
        onClose={() => setFormOpen(false)}
        onSuccess={(club, result) => {
          setFormOpen(false);
          setMessage({
            type: result?.cloudSynced === false ? "warning" : "success",
            text: result?.warning
              ? `Đã tạo CLB ${club.name}. Lưu ý: ${result.warning}`
              : `Đã tạo CLB ${club.name}. Bạn là Chủ tịch CLB — CLB đã lưu trên hệ thống chung.`,
          });
          onSuccess?.(club);
        }}
      />
    </Box>
  );
}
