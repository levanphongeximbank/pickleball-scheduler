import { useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import AddIcon from "@mui/icons-material/Add";
import DirectionsIcon from "@mui/icons-material/Directions";
import { Link as RouterLink } from "react-router-dom";

import { useClub } from "../context/ClubContext.jsx";
import { useCluster } from "../context/ClusterContext.jsx";
import { useTenant } from "../context/TenantContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS } from "../auth/permissions.js";
import { resolveRouteAccessScope } from "../auth/menuAccess.js";
import { isVenueScopedRole } from "../auth/roles.js";
import { isCourtClustersEnabled } from "../features/court-cluster/config/clusterFlags.js";
import { openClusterInGoogleMaps } from "../features/court-cluster/utils/clusterMapsUtils.js";
import {
  isCourtOwnerAwaitingClaim,
} from "../features/court-cluster/services/courtClaimRequestService.js";
import { ensureWritableClubForVenueOwner } from "../features/club/services/venueOwnerClubService.js";
import {
  getCourtDisplayName,
  loadCourts,
  removeCourt,
  saveCourts,
  toggleCourtStatus,
  upsertCourt,
  validateCourtName,
  validateCourtLimit,
  validateCourtLimitBulk,
  createCourtsBulk,
  buildBulkCourtRecords,
  getCourtCapacityForClub,
} from "./courts.logic";
import { COURT_STATUSES, COURT_TYPES } from "../models/court.js";
import { COURT_STATUS_LABELS } from "./courtManagement/courtManagement.constants.js";
import ClubDataTransferPanel from "./ClubDataTransferPanel";

export default function Courts() {
  const { activeClubId, activeClub, revision, refreshClubs } = useClub();
  const { activeClusterId, activeCluster } = useCluster();
  const { revision: tenantRevision } = useTenant();
  const { can, rbacEnabled, isAuthenticated, user } = useAuth();
  const scope = useMemo(
    () =>
      resolveRouteAccessScope({
        user,
        activeClubId,
        activeClub,
        activeClusterId,
      }),
    [user, activeClubId, activeClub, activeClusterId]
  );
  const canCreate =
    !rbacEnabled || !isAuthenticated || can(PERMISSIONS.COURT_CREATE, scope);
  const canUpdate =
    !rbacEnabled || !isAuthenticated || can(PERMISSIONS.COURT_UPDATE, scope);
  const canDelete =
    !rbacEnabled || !isAuthenticated || can(PERMISSIONS.COURT_DELETE, scope);
  const awaitingClusterClaim =
    isCourtClustersEnabled() && isCourtOwnerAwaitingClaim(user);
  const operationsBlocked = awaitingClusterClaim;
  const [courts, setCourts] = useState(() => loadCourts([], activeClubId));
  const [permissionError, setPermissionError] = useState(null);
  const [clubBootstrapError, setClubBootstrapError] = useState(null);
  const [writableClubId, setWritableClubId] = useState(activeClubId);
  const courtCapacity = useMemo(
    () => getCourtCapacityForClub(writableClubId || activeClubId),
    [writableClubId, activeClubId, revision, tenantRevision, courts.length]
  );

  useEffect(() => {
    if (!rbacEnabled || !isAuthenticated || !user || !isVenueScopedRole(user.role)) {
      setWritableClubId(activeClubId);
      return;
    }

    let cancelled = false;
    void Promise.resolve(ensureWritableClubForVenueOwner(user, { activeClubId })).then(
      (ensured) => {
        if (cancelled) {
          return;
        }
        if (!ensured.ok) {
          setClubBootstrapError(ensured.error || "Không thể khởi tạo CLB cho cơ sở.");
          return;
        }

        setClubBootstrapError(null);
        if (ensured.clubId) {
          setWritableClubId(ensured.clubId);
          if (ensured.created) {
            refreshClubs();
          }
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [activeClubId, isAuthenticated, rbacEnabled, refreshClubs, user]);

  useEffect(() => {
    setCourts(
      loadCourts([], writableClubId || activeClubId, {
        clusterId: activeClusterId,
        venueId: activeClub?.venueId || user?.venueId || null,
      })
    );
  }, [writableClubId, activeClubId, revision, activeClusterId, activeClub?.venueId, user?.venueId]);
  const [open, setOpen] = useState(false);
  const [quickSetupOpen, setQuickSetupOpen] = useState(false);
  const [bulkCourtCount, setBulkCourtCount] = useState("3");
  const [bulkFormError, setBulkFormError] = useState(null);
  const [deleteCourt, setDeleteCourt] = useState(null);

  const [courtName, setCourtName] = useState("");
  const [courtNumber, setCourtNumber] = useState("");
  const [courtType, setCourtType] = useState("outdoor");
  const [courtStatus, setCourtStatus] = useState("active");
  const [defaultHourlyRate, setDefaultHourlyRate] = useState("");
  const [peakHourlyRate, setPeakHourlyRate] = useState("");
  const [courtNote, setCourtNote] = useState("");
  const [editingCourt, setEditingCourt] = useState(null);
  const [formError, setFormError] = useState(null);

  const resetCourtForm = () => {
    setEditingCourt(null);
    setCourtName("");
    setCourtNumber("");
    setCourtType("outdoor");
    setCourtStatus("active");
    setDefaultHourlyRate("");
    setPeakHourlyRate("");
    setCourtNote("");
    setFormError(null);
  };

  const targetClubId = writableClubId || activeClubId;
  const bulkPreview = useMemo(() => {
    const count = Number(bulkCourtCount);
    if (!Number.isFinite(count) || count < 1) {
      return [];
    }
    return buildBulkCourtRecords(courts, count).map((court) => court.name);
  }, [bulkCourtCount, courts]);

  const updateCourts = (nextCourts, permission = PERMISSIONS.COURT_UPDATE) => {
    const result = saveCourts(nextCourts, targetClubId, {
      permission,
      clusterId: activeClusterId,
    });
    if (!result.ok) {
      setPermissionError(result.error || "Không có quyền thực hiện thao tác này.");
      return false;
    }
    setPermissionError(null);
    setCourts(
      loadCourts([], targetClubId, {
        clusterId: activeClusterId,
        venueId: activeClub?.venueId || user?.venueId || null,
      })
    );
    return true;
  };

  const handleSave = () => {
    const error = validateCourtName(courtName);

    if (error) {
      setFormError(error);
      return;
    }

    if (!editingCourt) {
      const limitError = validateCourtLimit(targetClubId, { isNew: true });
      if (limitError) {
        setFormError(limitError);
        return;
      }
    }

    setFormError(null);

    const updatedCourts = upsertCourt(courts, {
      courtName,
      courtNumber,
      editingCourt,
      extra: {
        courtType,
        status: courtStatus,
        active: courtStatus === "active",
        defaultHourlyRate: Number(defaultHourlyRate) || 0,
        peakHourlyRate: Number(peakHourlyRate) || 0,
        note: courtNote,
        clusterId: activeClusterId,
      },
    });

    const permission = editingCourt ? PERMISSIONS.COURT_UPDATE : PERMISSIONS.COURT_CREATE;
    const saved = updateCourts(updatedCourts, permission);
    if (!saved) {
      return;
    }

    resetCourtForm();
    setOpen(false);
  };

  const handleQuickSetup = () => {
    const count = Number(bulkCourtCount);
    if (!Number.isFinite(count) || count < 1) {
      setBulkFormError("Vui lòng nhập số sân hợp lệ (từ 1 trở lên).");
      return;
    }

    const limitError = validateCourtLimitBulk(targetClubId, count);
    if (limitError) {
      setBulkFormError(limitError);
      return;
    }

    if (!canCreate) {
      setBulkFormError("Không có quyền thêm sân.");
      return;
    }

    const updatedCourts = createCourtsBulk(courts, count);
    const saved = updateCourts(updatedCourts, PERMISSIONS.COURT_CREATE);
    if (!saved) {
      return;
    }

    setBulkFormError(null);
    setQuickSetupOpen(false);
  };

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Typography variant="h4" fontWeight="bold">
          🏟️ Quản lý sân
        </Typography>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="large"
            disabled={!canCreate || operationsBlocked}
            onClick={() => {
              setBulkCourtCount(String(courtCapacity?.remaining ?? 3));
              setBulkFormError(null);
              setQuickSetupOpen(true);
            }}
          >
            THIẾT LẬP NHANH
          </Button>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            disabled={!canCreate || operationsBlocked}
            onClick={() => {
              resetCourtForm();
              setOpen(true);
            }}
          >
            THÊM SÂN
          </Button>
        </Stack>
      </Box>

      {courtCapacity && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Đã có {courtCapacity.current} / tối đa {courtCapacity.maxCourts} sân
          {courtCapacity.planName ? ` (gói ${courtCapacity.planName})` : ""}
        </Typography>
      )}

      {awaitingClusterClaim && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Tài khoản chủ sân chưa được gắn cụm sân. Mở sidebar → <strong>Cơ sở hiện tại</strong> →{" "}
          <strong>Yêu cầu gắn cụm sân</strong> và chờ admin duyệt trước khi vận hành.
        </Alert>
      )}

      {clubBootstrapError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {clubBootstrapError}
        </Alert>
      )}

      {permissionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPermissionError(null)}>
          {permissionError}
        </Alert>
      )}

      {isCourtClustersEnabled() && activeCluster && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Stack direction="row" spacing={1}>
              <Button
                color="inherit"
                size="small"
                component={RouterLink}
                to="/court-management"
              >
                Cơ sở của tôi
              </Button>
              {activeCluster.googleMapsUrl ? (
                <Button
                  color="inherit"
                  size="small"
                  startIcon={<DirectionsIcon />}
                  onClick={() => openClusterInGoogleMaps(activeCluster)}
                >
                  Chỉ đường
                </Button>
              ) : null}
            </Stack>
          }
        >
          <strong>Cụm:</strong> {activeCluster.name}
          {activeCluster.address ? ` — ${activeCluster.address}` : ""}
          {typeof activeCluster.courtCount === "number"
            ? ` (${activeCluster.courtCount} sân)`
            : ""}
        </Alert>
      )}

      <ClubDataTransferPanel
        type="courts"
        items={courts}
        title="Export / Import sân"
        onImport={updateCourts}
      />

      <Grid container spacing={3}>
        {courts.length === 0 && (
          <Grid size={{ xs: 12 }}>
            <Alert severity="info">
              {awaitingClusterClaim ? (
                <>
                  Chưa có cụm sân được duyệt. Vào sidebar → <strong>Cơ sở hiện tại</strong> để
                  gửi yêu cầu gắn cụm sân.
                </>
              ) : (
                <>
                  Chưa có sân nào tại cơ sở hiện tại. Bấm <strong>THIẾT LẬP NHANH</strong> để tạo
                  nhiều sân cùng lúc, hoặc <strong>THÊM SÂN</strong> để thêm từng sân.
                </>
              )}
            </Alert>
          </Grid>
        )}
        {courts.map((court, index) => (
          <Grid
            key={court.id}
            size={{
              xs: 12,
              sm: 6,
              md: 4,
            }}
          >
            <Card
              elevation={4}
              sx={{
                borderRadius: 4,
              }}
            >
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h5" fontWeight="bold">
                    <SportsTennisIcon
                      sx={{
                        mr: 1,
                        verticalAlign: "middle",
                      }}
                    />

                    {getCourtDisplayName(court, index)}
                  </Typography>

                  <Typography color={court.active ? "green" : "text.secondary"}>
                    {court.active ? "🟢 Hoạt động" : "⚪ Không hoạt động"}
                    {" · "}
                    {COURT_STATUS_LABELS[court.status] || court.status}
                  </Typography>

                  {(court.defaultHourlyRate > 0 || court.peakHourlyRate > 0) && (
                    <Typography variant="body2" color="text.secondary">
                      Giá: {court.defaultHourlyRate?.toLocaleString("vi-VN")} /{" "}
                      {court.peakHourlyRate?.toLocaleString("vi-VN")} đ/giờ
                    </Typography>
                  )}

                  <CardActions
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mt: 2,
                    }}
                  >
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        disabled={!canUpdate}
                        onClick={() => {
                          setEditingCourt(court);
                          setCourtName(court.name || "");
                          setCourtNumber(court.number ?? "");
                          setCourtType(court.courtType || "outdoor");
                          setCourtStatus(court.status || "active");
                          setDefaultHourlyRate(String(court.defaultHourlyRate || ""));
                          setPeakHourlyRate(String(court.peakHourlyRate || ""));
                          setCourtNote(court.note || "");
                          setOpen(true);
                        }}
                      >
                        SỬA
                      </Button>
                      <Button
                        variant="outlined"
                        color={court.active ? "error" : "success"}
                        disabled={!canUpdate}
                        onClick={() => {
                          const updatedCourts = toggleCourtStatus(courts, court.id);
                          updateCourts(updatedCourts);
                        }}
                      >
                        {court.active ? "Tắt" : "Bật"}
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        disabled={!canDelete}
                        onClick={() => setDeleteCourt(court)}
                      >
                        Xóa
                      </Button>
                    </Stack>
                  </CardActions>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog
        open={open}
        onClose={() => {
          resetCourtForm();
          setOpen(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editingCourt ? "✏️ Sửa sân" : "➕ Thêm sân"}</DialogTitle>

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
            onChange={(e) => setCourtName(e.target.value)}
          />
          <TextField
            label="Số sân (tuỳ chọn)"
            fullWidth
            margin="normal"
            type="number"
            value={courtNumber}
            onChange={(e) => setCourtNumber(e.target.value)}
          />

          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Loại sân</InputLabel>
                <Select
                  label="Loại sân"
                  value={courtType}
                  onChange={(e) => setCourtType(e.target.value)}
                >
                  {COURT_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Trạng thái vận hành</InputLabel>
                <Select
                  label="Trạng thái vận hành"
                  value={courtStatus}
                  onChange={(e) => setCourtStatus(e.target.value)}
                >
                  {COURT_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {COURT_STATUS_LABELS[status] || status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <TextField
            label="Giá thường (đ/giờ)"
            fullWidth
            margin="normal"
            value={defaultHourlyRate}
            onChange={(e) => setDefaultHourlyRate(e.target.value)}
          />
          <TextField
            label="Giá cao điểm (đ/giờ)"
            fullWidth
            margin="normal"
            value={peakHourlyRate}
            onChange={(e) => setPeakHourlyRate(e.target.value)}
          />
          <TextField
            label="Ghi chú"
            fullWidth
            margin="normal"
            value={courtNote}
            onChange={(e) => setCourtNote(e.target.value)}
            multiline
            minRows={2}
          />
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => {
              resetCourtForm();
              setOpen(false);
            }}
          >
            HỦY
          </Button>

          <Button variant="contained" onClick={handleSave}>
            LƯU
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={quickSetupOpen}
        onClose={() => {
          setBulkFormError(null);
          setQuickSetupOpen(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Thiết lập nhanh sân</DialogTitle>
        <DialogContent>
          {bulkFormError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {bulkFormError}
            </Alert>
          )}
          <DialogContentText sx={{ mb: 2 }}>
            Nhập số sân tại cơ sở của bạn (2, 3, 4, 6...). Hệ thống sẽ tạo tên Sân 1, Sân 2, ...
          </DialogContentText>
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
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setBulkFormError(null);
              setQuickSetupOpen(false);
            }}
          >
            Hủy
          </Button>
          <Button variant="contained" onClick={handleQuickSetup}>
            Tạo {bulkCourtCount || 0} sân
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteCourt !== null}
        onClose={() => setDeleteCourt(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Xác nhận xóa sân</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Bạn có chắc muốn xóa sân <strong>{deleteCourt ? getCourtDisplayName(deleteCourt) : ""}</strong>? Hành động này không thể hoàn tác.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteCourt(null)}>Hủy</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (!deleteCourt) {
                return;
              }

              const updatedCourts = removeCourt(courts, deleteCourt.id);
              updateCourts(updatedCourts, PERMISSIONS.COURT_DELETE);
              setDeleteCourt(null);
            }}
          >
            Xóa
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
