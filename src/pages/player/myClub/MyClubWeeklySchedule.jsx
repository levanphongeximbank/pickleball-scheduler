import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import EventIcon from "@mui/icons-material/Event";

import {
  CLUB_ACTIVITY_DAY_LABELS,
  canManageClubActivitySchedule,
  createClubActivitySession,
  deleteClubActivitySession,
  getClubById,
  getTodayClubActivitySessions,
  listClubActivitySessions,
  updateClubActivitySession,
} from "../../../features/club/index.js";
import { listClustersForVenue } from "../../../features/court-cluster/services/courtClusterService.js";
import { getTodayActivityDayOfWeek, WEEK_DAY_SHORT_LABELS, WEEK_GRID_DAYS } from "./myClubViewLogic.js";

const EMPTY_FORM = {
  dayOfWeek: 3,
  startTime: "18:00",
  endTime: "21:00",
  clusterId: "",
  note: "",
};

export default function MyClubWeeklySchedule({
  clubId,
  tenantId,
  user,
  revision = 0,
  onRevision,
  onMessage,
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const club = useMemo(() => getClubById(clubId, tenantId), [clubId, tenantId, revision]);
  const canManage = club && user && canManageClubActivitySchedule(user, club);
  const venueClusters = useMemo(() => listClustersForVenue(tenantId), [tenantId]);

  const sessions = useMemo(() => {
    void revision;
    return listClubActivitySessions(clubId, tenantId).map((session) => {
      const cluster = venueClusters.find((item) => item.id === session.clusterId);
      return {
        ...session,
        dayLabel: CLUB_ACTIVITY_DAY_LABELS[session.dayOfWeek] || `Ngày ${session.dayOfWeek}`,
        clusterLabel: cluster?.name || null,
      };
    });
  }, [clubId, tenantId, revision, venueClusters]);

  const todaySessions = useMemo(() => {
    void revision;
    return getTodayClubActivitySessions(clubId, tenantId);
  }, [clubId, tenantId, revision]);

  const todayDayOfWeek = getTodayActivityDayOfWeek();

  const sessionsByDay = useMemo(() => {
    const map = new Map();
    for (const day of WEEK_GRID_DAYS) {
      map.set(day, []);
    }
    for (const session of sessions) {
      const bucket = map.get(session.dayOfWeek) || [];
      bucket.push(session);
      map.set(session.dayOfWeek, bucket);
    }
    return map;
  }, [sessions]);

  const openCreate = () => {
    setEditingSession(null);
    setForm({
      ...EMPTY_FORM,
      clusterId: club?.governance?.registeredClusterId || "",
    });
    setDialogOpen(true);
  };

  const openEdit = (session) => {
    setEditingSession(session);
    setForm({
      dayOfWeek: session.dayOfWeek,
      startTime: session.startTime,
      endTime: session.endTime,
      clusterId: session.clusterId || "",
      note: session.note || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setBusy(true);
    const payload = {
      dayOfWeek: Number(form.dayOfWeek),
      startTime: form.startTime,
      endTime: form.endTime,
      clusterId: form.clusterId || null,
      note: form.note,
    };

    const result = editingSession
      ? await updateClubActivitySession(clubId, editingSession.id, tenantId, payload, { user })
      : await createClubActivitySession(clubId, tenantId, payload, { user });

    setBusy(false);
    if (!result.ok) {
      onMessage?.({ type: "error", text: result.error });
      return;
    }

    onMessage?.({
      type: "success",
      text: editingSession ? "Đã cập nhật buổi sinh hoạt." : "Đã thêm buổi sinh hoạt.",
    });
    setDialogOpen(false);
    onRevision?.();
  };

  const handleDelete = async (session) => {
    if (!window.confirm(`Xóa buổi sinh hoạt ${session.dayLabel}?`)) {
      return;
    }
    setBusy(true);
    const result = await deleteClubActivitySession(clubId, session.id, tenantId, { user });
    setBusy(false);
    if (!result.ok) {
      onMessage?.({ type: "error", text: result.error });
      return;
    }
    onMessage?.({ type: "info", text: "Đã xóa buổi sinh hoạt." });
    onRevision?.();
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          Lịch sinh hoạt tuần
        </Typography>
        {canManage && (
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Thêm buổi
          </Button>
        )}
      </Stack>

      {todaySessions.length > 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Hôm nay có sinh hoạt:{" "}
          {todaySessions
            .map((session) => `${session.startTime}–${session.endTime}`)
            .join(", ")}
        </Alert>
      )}

      <Grid container spacing={1} sx={{ mb: 2, display: { xs: "none", md: "flex" } }}>
        {WEEK_GRID_DAYS.map((day) => {
          const daySessions = sessionsByDay.get(day) || [];
          const isToday = day === todayDayOfWeek;
          const shortLabel = WEEK_DAY_SHORT_LABELS[day] || `T${day}`;

          return (
            <Grid item xs key={day} sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  p: 1,
                  borderRadius: 2,
                  border: "2px solid",
                  borderColor: isToday ? "primary.main" : "divider",
                  bgcolor: isToday ? "primary.light" : "background.paper",
                  minHeight: 120,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="caption" fontWeight={700}>
                    {shortLabel}
                  </Typography>
                  {isToday && <Chip size="small" label="Hôm nay" color="primary" />}
                </Stack>
                {daySessions.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    —
                  </Typography>
                ) : (
                  <Stack spacing={0.75}>
                    {daySessions.map((session) => (
                      <Box
                        key={session.id}
                        sx={{
                          p: 0.75,
                          borderRadius: 1,
                          bgcolor: "rgba(16, 185, 129, 0.18)",
                        }}
                      >
                        <Typography variant="caption" fontWeight={600} display="block">
                          {session.startTime}–{session.endTime}
                        </Typography>
                        {session.clusterLabel && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {session.clusterLabel}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Grid>
          );
        })}
      </Grid>

      {sessions.length === 0 ? (
        <Alert severity="info">CLB chưa có lịch sinh hoạt cố định trong tuần.</Alert>
      ) : (
        <Stack spacing={1.5} sx={{ display: { xs: "flex", md: "none" } }}>
          {sessions.map((session) => (
            <Card key={session.id} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ py: 1.5 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  spacing={1}
                >
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <EventIcon color="primary" fontSize="small" />
                    <Typography fontWeight={600}>
                      {session.dayLabel} · {session.startTime}–{session.endTime}
                    </Typography>
                    {session.clusterLabel && (
                      <Typography variant="body2" color="text.secondary">
                        · {session.clusterLabel}
                      </Typography>
                    )}
                    <Chip size="small" label="Nhắc trước 1 ngày" variant="outlined" />
                  </Stack>

                  {canManage && (
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" onClick={() => openEdit(session)} disabled={busy}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(session)}
                        disabled={busy}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  )}
                </Stack>
                {session.note && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                    {session.note}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {sessions.length > 0 && (
        <Stack spacing={1.5} sx={{ display: { xs: "none", md: "flex" } }}>
          {sessions.map((session) => (
            <Card key={`manage-${session.id}`} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ py: 1.5 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  spacing={1}
                >
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <EventIcon color="primary" fontSize="small" />
                    <Typography fontWeight={600}>
                      {session.dayLabel} · {session.startTime}–{session.endTime}
                    </Typography>
                    {session.clusterLabel && (
                      <Typography variant="body2" color="text.secondary">
                        · {session.clusterLabel}
                      </Typography>
                    )}
                  </Stack>

                  {canManage && (
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" onClick={() => openEdit(session)} disabled={busy}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(session)}
                        disabled={busy}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  )}
                </Stack>
                {session.note && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                    {session.note}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingSession ? "Sửa buổi sinh hoạt" : "Thêm buổi sinh hoạt"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Thứ</InputLabel>
              <Select
                value={form.dayOfWeek}
                label="Thứ"
                onChange={(event) => setForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))}
              >
                {Object.entries(CLUB_ACTIVITY_DAY_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={Number(value)}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Bắt đầu"
                type="time"
                value={form.startTime}
                onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Kết thúc"
                type="time"
                value={form.endTime}
                onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <FormControl fullWidth>
              <InputLabel>Cụm sân</InputLabel>
              <Select
                value={form.clusterId}
                label="Cụm sân"
                onChange={(event) => setForm((prev) => ({ ...prev, clusterId: event.target.value }))}
              >
                <MenuItem value="">
                  <em>Không chọn</em>
                </MenuItem>
                {venueClusters.map((cluster) => (
                  <MenuItem key={cluster.id} value={cluster.id}>
                    {cluster.name || cluster.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Ghi chú"
              value={form.note}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              multiline
              minRows={2}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSave} disabled={busy}>
            Lưu
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
