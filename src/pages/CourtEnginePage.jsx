import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SearchIcon from "@mui/icons-material/Search";
import StopIcon from "@mui/icons-material/Stop";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

import { useAuth } from "../context/AuthContext.jsx";
import { useClub } from "../context/ClubContext.jsx";
import { useSeasonLeague } from "../context/SeasonContext.jsx";
import { useTenant } from "../context/TenantContext.jsx";
import { getCourtDisplayName } from "../models/court.js";
import {
  canUseCourtEngine,
  canTransferCourt,
  canRunScheduling,
  canViewCourts,
  canCreateCourt,
  canUpdateCourt,
} from "../features/court-engine/guards/courtEngineGuard.js";
import { resolveRouteAccessScope } from "../auth/menuAccess.js";
import CourtQuickManageDialog from "../features/court-engine/components/CourtQuickManageDialog.jsx";
import { resolveCourtEngineContextState } from "../features/court-engine/guards/courtEngineContextGuard.js";
import { useCourtEngine } from "../features/court-engine/hooks/useCourtEngine.js";
import { ASSIGNMENT_STATUS, COURT_RUNTIME_STATUS, SESSION_STATUS } from "../features/court-engine/constants/statuses.js";
import { buildPlatformEngineSummary } from "../core/platform/engines/index.js";
import ForbiddenPage from "./ForbiddenPage.jsx";

function StatusChip({ status }) {
  const colors = {
    empty: "default",
    playing: "success",
    paused: "warning",
    overrun: "error",
    locked: "error",
    maintenance: "warning",
    assigned: "info",
  };
  return <Chip size="small" label={status} color={colors[status] || "default"} />;
}

function CourtEngineAccessGate({ children }) {
  const { can, rbacEnabled, isAuthenticated, user } = useAuth();
  const { activeClubId, activeClub } = useClub();
  const scope = resolveRouteAccessScope({ user, activeClubId, activeClub });
  const allowed = canUseCourtEngine(can, scope);

  if (rbacEnabled && isAuthenticated && !allowed) {
    return <ForbiddenPage />;
  }

  return children;
}

function CourtEngineContextGate({ children }) {
  const { rbacEnabled, isAuthenticated } = useAuth();
  const { activeClubId } = useClub();
  const {
    seasons,
    activeSeason,
    activeLeague,
    leaguesForActiveSeason,
  } = useSeasonLeague();
  const { tenantCheck } = useTenant();

  const contextState = useMemo(
    () =>
      resolveCourtEngineContextState({
        activeClubId,
        seasons,
        activeSeason,
        leaguesForActiveSeason,
        activeLeague,
        tenantCheck,
        rbacEnabled,
        isAuthenticated,
      }),
    [
      activeClubId,
      seasons,
      activeSeason,
      leaguesForActiveSeason,
      activeLeague,
      tenantCheck,
      rbacEnabled,
      isAuthenticated,
    ]
  );

  if (!contextState.ready) {
    const isTenantError = contextState.code === "TENANT_ERROR";
    return (
      <Box sx={{ py: 6, px: 2, maxWidth: 560, mx: "auto" }}>
        <Alert severity={isTenantError ? "error" : "info"} sx={{ mb: 2 }}>
          {contextState.message}
        </Alert>
        {!isTenantError && (
          <Button
            component={RouterLink}
            to="/club-management"
            variant="contained"
            sx={{ mr: 1 }}
          >
            Tạo mùa giải / chọn mùa giải
          </Button>
        )}
      </Box>
    );
  }

  return children;
}

function CourtEnginePageContent() {
  const { can, rbacEnabled, isAuthenticated, user } = useAuth();
  const { activeClubId, activeClub, refreshClubs } = useClub();
  const { activeLeague } = useSeasonLeague();
  const scope = useMemo(
    () => resolveRouteAccessScope({ user, activeClubId, activeClub }),
    [user, activeClubId, activeClub]
  );
  const engine = useCourtEngine();
  const {
    session,
    players,
    courts,
    refereeList,
    summary,
    queueEntries,
    playersById,
    message,
    error,
    preview,
    setMessage,
    setError,
    setPreview,
    actions,
    utils,
  } = engine;

  const [search, setSearch] = useState("");
  const [transferDialog, setTransferDialog] = useState(null);
  const [transferReason, setTransferReason] = useState("");
  const [transferTargetCourt, setTransferTargetCourt] = useState("");
  const [courtDialog, setCourtDialog] = useState(null);
  const [, tick] = useState(0);
  const platformSummary = useMemo(
    () =>
      buildPlatformEngineSummary({
        session,
        players,
        courts,
        tournament: {
          leagueId: activeLeague?.id || null,
          clubId: activeClubId || null,
        },
      }),
    [session, players, courts, activeLeague?.id, activeClubId]
  );

  useEffect(() => {
    const timer = setInterval(() => tick((v) => v + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const canTransfer =
    !rbacEnabled ||
    !isAuthenticated ||
    canTransferCourt(can, scope);

  const canSchedule =
    !rbacEnabled ||
    !isAuthenticated ||
    canRunScheduling(can, scope);

  const canManageCourtsLink =
    !rbacEnabled ||
    !isAuthenticated ||
    canViewCourts(can, scope);

  const canAddCourt =
    !rbacEnabled ||
    !isAuthenticated ||
    canCreateCourt(can, scope);

  const canEditCourt =
    !rbacEnabled ||
    !isAuthenticated ||
    canUpdateCourt(can, scope);

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players.slice(0, 20);
    return players.filter((player) => String(player.name || "").toLowerCase().includes(q));
  }, [players, search]);

  const activeAssignments = (session?.assignments || []).filter((item) =>
    ["proposed", "assigned", "playing", "paused", "overrun"].includes(item.status)
  );

  const checkedInIds = new Set((session?.checkIns || []).map((item) => String(item.playerId)));

  if (!session) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
        <CircularProgress size={32} />
        <Typography sx={{ ml: 2 }} color="text.secondary">
          Đang khởi tạo phiên điều phối sân...
        </Typography>
      </Box>
    );
  }

  const leagueLabel = platformSummary?.league?.standing?.leagueId || activeLeague?.id || "—";
  const courtLabel = platformSummary?.court?.schedule?.courtId || "—";

  return (
    <Box sx={{ pb: 4 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ md: "center" }}
          sx={{ mb: 2 }}
        >
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5" fontWeight="bold">
              Court Engine
            </Typography>
            <Typography color="text.secondary">
              {session?.name || "Phiên điều phối sân"} ·{" "}
              {session?.status === SESSION_STATUS.OPEN ? "Đang mở" : session?.status || "—"}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {canManageCourtsLink && (
              <Button component={RouterLink} to="/court-management/courts" variant="outlined">
                Quản lý sân
              </Button>
            )}
            {canAddCourt && (
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setCourtDialog({ mode: "create" })}
              >
                Thêm sân
              </Button>
            )}
            {session?.status !== SESSION_STATUS.OPEN ? (
              <Button variant="contained" onClick={actions.openSession} disabled={!canSchedule}>
                Mở session
              </Button>
            ) : (
              <Button color="warning" variant="outlined" onClick={actions.closeSession} disabled={!canSchedule}>
                Đóng session
              </Button>
            )}
            <Button
              variant="contained"
              color="secondary"
              startIcon={<AutoFixHighIcon />}
              onClick={actions.previewAutoAssign}
              disabled={!canSchedule}
            >
              Ghép sân tự động
            </Button>
          </Stack>
        </Stack>

        <Box sx={{ mb: 2, p: 2, border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "background.paper" }}>
          <Typography variant="subtitle2" color="primary" sx={{ mb: 0.5 }}>
            Platform v5 Court Preview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Court schedule: {courtLabel} · League: {leagueLabel}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ranking entries: {platformSummary?.ranking?.result?.entries?.length ?? 0} · Billing:{" "}
            {platformSummary?.billing?.invoice?.amount ?? 0} đ
          </Typography>
        </Box>

        {summary && (
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            {[
              ["Check-in", summary.checkedIn],
              ["Chờ", summary.waiting],
              ["Đang chơi", summary.playing],
              ["Nghỉ", summary.resting],
              ["Hoàn tất", summary.completed],
              ["Queue", summary.queueActive],
            ].map(([label, value]) => (
              <Grid item xs={6} sm={4} md={2} key={label}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">
                      {label}
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {value}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} lg={4}>
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Check-in
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Tìm người chơi..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ mb: 1 }}
                />
                <List dense sx={{ maxHeight: 280, overflow: "auto" }}>
                  {filteredPlayers.map((player) => {
                    const checked = checkedInIds.has(String(player.id));
                    return (
                      <ListItem key={player.id} divider>
                        <ListItemText
                          primary={player.name}
                          secondary={`${player.rating ?? player.level ?? "—"} · ${player.gender || "—"}`}
                        />
                        <ListItemSecondaryAction>
                          {checked ? (
                            <Stack direction="row" spacing={0.5}>
                              <Button size="small" disabled={!canSchedule} onClick={() => actions.addToQueue(player.id)}>
                                Queue
                              </Button>
                              <Button size="small" color="warning" disabled={!canSchedule} onClick={() => actions.cancelCheckIn(player.id)}>
                                Hủy
                              </Button>
                            </Stack>
                          ) : (
                            <Button size="small" variant="contained" disabled={!canSchedule} onClick={() => actions.checkIn(player.id)}>
                              Check-in
                            </Button>
                          )}
                        </ListItemSecondaryAction>
                      </ListItem>
                    );
                  })}
                </List>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Queue ({queueEntries.length})
                </Typography>
                {queueEntries.length === 0 ? (
                  <Typography color="text.secondary">Chưa có người trong hàng chờ.</Typography>
                ) : (
                  <List dense>
                    {queueEntries.map((entry) => {
                      const player = playersById.get(String(entry.playerId));
                      return (
                        <ListItem key={entry.id} divider>
                          <ListItemText
                            primary={player?.name || entry.playerId}
                            secondary={`Chờ ${entry.waitCount ?? 0} · ${entry.playCount || 0} trận`}
                          />
                          <ListItemSecondaryAction>
                            <Stack direction="row" spacing={0.5}>
                              <IconButton size="small" disabled={!canSchedule} onClick={() => actions.setPriority(entry.playerId, 1)} title="Ưu tiên">
                                ↑
                              </IconButton>
                              <IconButton
                                size="small"
                                disabled={!canSchedule}
                                onClick={() => actions.setQueueLocked(entry.playerId, !entry.locked)}
                                title={entry.locked ? "Mở khóa" : "Khóa auto"}
                              >
                                {entry.locked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
                              </IconButton>
                              <Button size="small" color="error" disabled={!canSchedule} onClick={() => actions.removeFromQueue(entry.playerId)}>
                                Xóa
                              </Button>
                            </Stack>
                          </ListItemSecondaryAction>
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6">
                Live Courts ({courts.length})
              </Typography>
              {canAddCourt && (
                <Button size="small" startIcon={<AddIcon />} onClick={() => setCourtDialog({ mode: "create" })}>
                  Thêm sân
                </Button>
              )}
            </Stack>
            <Grid container spacing={1.5}>
              {courts.map((court, index) => {
                const assignment = activeAssignments.find(
                  (item) => String(item.courtId) === String(court.id)
                );
                const courtState = session?.courtStates?.[String(court.id)] || {};
                const timerStatus = assignment
                  ? utils.resolveTimerStatus(assignment, session?.config)
                  : courtState.status || COURT_RUNTIME_STATUS.EMPTY;
                const elapsed = assignment ? utils.getMatchElapsedMinutes(assignment) : 0;

                return (
                  <Grid item xs={12} sm={6} key={court.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderColor:
                          timerStatus === COURT_RUNTIME_STATUS.OVERRUN
                            ? "error.main"
                            : timerStatus === COURT_RUNTIME_STATUS.PLAYING
                              ? "success.light"
                              : "divider",
                      }}
                    >
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography fontWeight="bold">{getCourtDisplayName(court, index)}</Typography>
                          <StatusChip status={timerStatus} />
                        </Stack>
                        {court.clubName && (
                          <Typography variant="caption" color="text.secondary">
                            CLB: {court.clubName}
                          </Typography>
                        )}
                        {assignment ? (
                          <>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {assignment.teams?.[0]?.label || "Đội A"} vs{" "}
                              {assignment.teams?.[1]?.label || "Đội B"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {elapsed} phút · TT: {assignment.refereeId || "—"}
                            </Typography>
                            <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap">
                              {assignment.status === ASSIGNMENT_STATUS.ASSIGNED && (
                                <Button size="small" disabled={!canSchedule} startIcon={<PlayArrowIcon />} onClick={() => actions.startMatch(assignment.id)}>
                                  Bắt đầu
                                </Button>
                              )}
                              {assignment.status === ASSIGNMENT_STATUS.PLAYING && (
                                <Button size="small" disabled={!canSchedule} startIcon={<PauseIcon />} onClick={() => actions.pauseMatch(assignment.id)}>
                                  Pause
                                </Button>
                              )}
                              {assignment.status === ASSIGNMENT_STATUS.PAUSED && (
                                <Button size="small" disabled={!canSchedule} startIcon={<PlayArrowIcon />} onClick={() => actions.resumeMatch(assignment.id)}>
                                  Resume
                                </Button>
                              )}
                              <Button size="small" color="error" disabled={!canSchedule} startIcon={<StopIcon />} onClick={() => actions.endMatch(assignment.id)}>
                                Kết thúc
                              </Button>
                              {canTransfer && (
                                <Button
                                  size="small"
                                  startIcon={<SwapHorizIcon />}
                                  onClick={() => {
                                    setTransferDialog(assignment);
                                    setTransferReason("");
                                    setTransferTargetCourt("");
                                  }}
                                >
                                  Chuyển sân
                                </Button>
                              )}
                            </Stack>
                          </>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Sân trống
                          </Typography>
                        )}
                        <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                          <Button
                            size="small"
                            disabled={!canSchedule}
                            onClick={() => actions.lockCourt(court.id, !courtState.locked)}
                          >
                            {courtState.locked ? "Mở khóa" : "Khóa sân"}
                          </Button>
                          <Button
                            size="small"
                            disabled={!canSchedule}
                            onClick={() =>
                              actions.maintenanceCourt(
                                court.id,
                                courtState.status !== COURT_RUNTIME_STATUS.MAINTENANCE
                              )
                            }
                          >
                            Bảo trì
                          </Button>
                          {canEditCourt && (
                            <Button
                              size="small"
                              startIcon={<EditIcon />}
                              onClick={() => setCourtDialog({ mode: "edit", court })}
                            >
                              Sửa
                            </Button>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Grid>

          <Grid item xs={12} lg={3}>
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Trọng tài ({refereeList.length})
                </Typography>
                {refereeList.length === 0 ? (
                  <Typography color="text.secondary">Chưa có trọng tài trong staff.</Typography>
                ) : (
                  <List dense>
                    {refereeList.map((ref) => (
                      <ListItem key={ref.id} divider>
                        <ListItemText primary={ref.name} secondary={ref.status} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Activity Log
                </Typography>
                <List dense sx={{ maxHeight: 360, overflow: "auto" }}>
                  {(session?.events || []).slice(0, 30).map((event) => (
                    <ListItem key={event.id} alignItems="flex-start">
                      <ListItemText
                        primary={event.message}
                        secondary={new Date(event.createdAt).toLocaleString("vi-VN")}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} maxWidth="md" fullWidth>
          <DialogTitle>Đề xuất ghép sân tự động</DialogTitle>
          <DialogContent dividers>
            {preview?.warnings?.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {preview.warnings.join(" ")}
              </Alert>
            )}
            {preview?.assignments?.length === 0 ? (
              <Typography>Không có đề xuất nào.</Typography>
            ) : (
              preview?.assignments?.map((item) => (
                <Card key={item.id} variant="outlined" sx={{ mb: 1 }}>
                  <CardContent>
                    <Typography fontWeight="bold">
                      {item.courtName}: {item.teams?.[0]?.label} vs {item.teams?.[1]?.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.reasons?.join(" · ")}
                    </Typography>
                    {item.scoreBreakdown && (
                      <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                        Score: {Math.round(item.scoreBreakdown.totalScore)}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPreview(null)}>Hủy</Button>
            <Button variant="contained" onClick={actions.confirmAutoAssign} disabled={!canSchedule || !preview?.assignments?.length}>
              Xác nhận
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(transferDialog)} onClose={() => setTransferDialog(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Chuyển sân</DialogTitle>
          <DialogContent dividers>
            <TextField
              select
              fullWidth
              label="Sân đích"
              value={transferTargetCourt}
              onChange={(event) => setTransferTargetCourt(event.target.value)}
              SelectProps={{ native: true }}
              sx={{ mb: 2, mt: 1 }}
            >
              <option value="">Chọn sân</option>
              {courts
                .filter((court) => String(court.id) !== String(transferDialog?.courtId))
                .map((court, index) => (
                  <option key={court.id} value={court.id}>
                    {getCourtDisplayName(court, index)}
                  </option>
                ))}
            </TextField>
            <TextField
              fullWidth
              required
              label="Lý do chuyển sân"
              value={transferReason}
              onChange={(event) => setTransferReason(event.target.value)}
              multiline
              minRows={2}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTransferDialog(null)}>Hủy</Button>
            <Button
              variant="contained"
              color="warning"
              disabled={!transferTargetCourt || !transferReason.trim()}
              onClick={() => {
                actions.transfer(transferDialog.id, transferTargetCourt, transferReason.trim());
                setTransferDialog(null);
              }}
            >
              Xác nhận chuyển
            </Button>
          </DialogActions>
        </Dialog>

        <CourtQuickManageDialog
          open={Boolean(courtDialog)}
          editingCourt={courtDialog?.mode === "edit" ? courtDialog.court : null}
          clubId={courtDialog?.court?.clubId || activeClubId}
          onClose={() => setCourtDialog(null)}
          onSaved={() => {
            refreshClubs();
            engine.bump();
          }}
        />

        <Snackbar open={Boolean(message)} autoHideDuration={4000} onClose={() => setMessage(null)}>
          <Alert severity="success" onClose={() => setMessage(null)}>
            {message}
          </Alert>
        </Snackbar>
        <Snackbar open={Boolean(error)} autoHideDuration={5000} onClose={() => setError(null)}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Snackbar>
      </Box>
  );
}

export default function CourtEnginePage() {
  return (
    <CourtEngineAccessGate>
      <CourtEngineContextGate>
        <CourtEnginePageContent />
      </CourtEngineContextGate>
    </CourtEngineAccessGate>
  );
}
