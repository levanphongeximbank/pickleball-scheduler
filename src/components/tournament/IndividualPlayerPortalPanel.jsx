import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import SportsScoreIcon from "@mui/icons-material/SportsScore";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import ScheduleIcon from "@mui/icons-material/Schedule";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import HistoryIcon from "@mui/icons-material/History";

import {
  TournamentEmptyState,
  TournamentErrorState,
  TournamentLoadingState,
} from "./TournamentUiState.jsx";
import { touchButtonSx, MOBILE_PAGE_GUTTER, horizontalScrollSx } from "./mobileUi.js";
import PlayerSchedulePanel from "./PlayerSchedulePanel.jsx";
import PlayerFinalResultsPanel from "./PlayerFinalResultsPanel.jsx";
import { individualPlayerRegistrationPath } from "../../config/tournamentRoutes.js";

const PORTAL_TABS = [
  { id: "dashboard", label: "Tổng quan", icon: <SportsScoreIcon fontSize="small" /> },
  { id: "schedule", label: "Lịch", icon: <ScheduleIcon fontSize="small" /> },
  { id: "standings", label: "BXH", icon: <SportsScoreIcon fontSize="small" /> },
  { id: "bracket", label: "Nhánh", icon: <AccountTreeIcon fontSize="small" /> },
  { id: "awards", label: "Giải thưởng", icon: <EmojiEventsIcon fontSize="small" /> },
  { id: "history", label: "Lịch sử", icon: <HistoryIcon fontSize="small" /> },
  { id: "notifications", label: "Thông báo", icon: <NotificationsActiveIcon fontSize="small" /> },
];

function formatWhen(iso) {
  if (!iso) return "Chưa xếp giờ";
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

export default function IndividualPlayerPortalPanel({
  loading = false,
  error = null,
  onRetry,
  dashboard = null,
  notifications = [],
  unreadCount = 0,
  tournament = null,
  entryOptions = [],
  selectedEntryId = "",
  onSelectEntry,
  onMarkAllRead,
  onDismissNotification,
}) {
  const [tab, setTab] = useState("dashboard");

  const entryLabels = useMemo(() => {
    const map = {};
    (tournament?.events || []).forEach((event) => {
      (event.entries || []).forEach((entry) => {
        map[entry.id] = entry.name || entry.id;
      });
    });
    return map;
  }, [tournament]);

  if (loading) {
    return <TournamentLoadingState label="Đang tải cổng VĐV…" />;
  }

  if (error) {
    return (
      <TournamentErrorState
        title="Không tải được cổng VĐV"
        description={error}
        onRetry={onRetry}
      />
    );
  }

  if (!dashboard) {
    return (
      <TournamentEmptyState
        title="Chọn giải để xem cổng VĐV"
        description="Danh sách giải bạn đã đăng ký sẽ hiện ở bên trái / phía trên."
      />
    );
  }

  if (!dashboard.enrolled) {
    return (
      <Stack spacing={2} sx={{ px: { xs: MOBILE_PAGE_GUTTER.xs, sm: 0 } }}>
        <Alert severity="info">{dashboard.message}</Alert>
        <Button
          component={RouterLink}
          to={individualPlayerRegistrationPath(dashboard.tournament?.id)}
          variant="contained"
          sx={touchButtonSx}
        >
          Đăng ký giải này
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={2} sx={{ px: { xs: MOBILE_PAGE_GUTTER.xs, sm: 0 }, pb: 8 }}>
      <Paper sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ sm: "center" }}
        >
          <Box>
            <Typography variant="h5" fontWeight={800}>
              {dashboard.tournament.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {dashboard.event.name} · {dashboard.entry.name}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={dashboard.tournament.status} />
              {dashboard.tournament.closed ? (
                <Chip size="small" color="success" label="Đã kết thúc" />
              ) : null}
              {dashboard.entry.seed != null ? (
                <Chip size="small" color="primary" label={`Seed #${dashboard.entry.seed}`} />
              ) : null}
            </Stack>
          </Box>
          {entryOptions.length > 1 ? (
            <TextField
              select
              size="small"
              label="Nội dung của tôi"
              value={selectedEntryId}
              onChange={(e) => onSelectEntry?.(e.target.value)}
              sx={{ minWidth: 200 }}
              inputProps={{ "aria-label": "Chọn nội dung đăng ký" }}
            >
              {entryOptions.map((opt) => (
                <MenuItem key={opt.entryId} value={opt.entryId}>
                  {opt.eventName}: {opt.entryName}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
        </Stack>
      </Paper>

      <Box sx={horizontalScrollSx}>
        <Tabs
          value={tab}
          onChange={(_e, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Cổng vận động viên"
        >
          {PORTAL_TABS.map((item) => (
            <Tab
              key={item.id}
              value={item.id}
              icon={
                item.id === "notifications" ? (
                  <Badge badgeContent={unreadCount} color="error" max={9}>
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )
              }
              iconPosition="start"
              label={item.label}
              sx={{ minHeight: 48 }}
            />
          ))}
        </Tabs>
      </Box>

      {tab === "dashboard" ? (
        <Stack spacing={2}>
          <Paper sx={{ p: 2 }}>
            <Typography fontWeight={700} sx={{ mb: 1 }}>
              Trận sắp tới
            </Typography>
            {(dashboard.upcomingMatches || []).length === 0 ? (
              <TournamentEmptyState
                title="Chưa có trận sắp tới"
                description="Khi BTC xếp lịch, trận của bạn sẽ hiện tại đây."
              />
            ) : (
              <List dense>
                {dashboard.upcomingMatches.map((match) => (
                  <ListItem key={match.id} divider>
                    <ListItemText
                      primary={`${entryLabels[match.entryAId] || match.entryAId} vs ${
                        entryLabels[match.entryBId] || match.entryBId
                      }`}
                      secondary={`${formatWhen(match.scheduledStart)} · ${match.status}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography fontWeight={700} sx={{ mb: 1 }}>
              Thứ hạng hiện tại
            </Typography>
            {dashboard.standing?.row ? (
              <Stack spacing={0.5}>
                <Typography>
                  Bảng {dashboard.standing.groupId || "—"} · Hạng{" "}
                  {dashboard.standing.row.rank ?? "—"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  W {dashboard.standing.row.won ?? 0} · L {dashboard.standing.row.lost ?? 0} · Điểm{" "}
                  {dashboard.standing.row.matchPoints ?? "—"}
                </Typography>
              </Stack>
            ) : (
              <TournamentEmptyState title="Chưa có BXH" description="Hoàn thành trận vòng bảng để cập nhật." />
            )}
          </Paper>
        </Stack>
      ) : null}

      {tab === "schedule" ? (
        tournament ? (
          <PlayerSchedulePanel
            tournament={tournament}
            entryId={dashboard.entry.id}
            entryLabels={entryLabels}
          />
        ) : (
          <TournamentEmptyState title="Chưa có lịch" />
        )
      ) : null}

      {tab === "standings" ? (
        <Paper sx={{ p: 2 }}>
          {dashboard.standing?.row ? (
            <Stack spacing={1}>
              <Typography fontWeight={700}>
                VĐV / Cặp: {dashboard.standing.row.name || dashboard.entry.name}
              </Typography>
              <Typography>Thứ hạng: {dashboard.standing.row.rank ?? "—"}</Typography>
              <Typography variant="body2" color="text.secondary">
                {dashboard.standing.tieBreakExplanation || "W–L · điểm trận · hiệu số"}
              </Typography>
              {(dashboard.finalRanking || []).length > 0 ? (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Typography fontWeight={700}>Podium</Typography>
                  {dashboard.finalRanking.map((row) => (
                    <Typography key={row.entryId} variant="body2">
                      #{row.rank} {row.name} {row.medal ? `(${row.medal})` : ""}
                    </Typography>
                  ))}
                </>
              ) : null}
            </Stack>
          ) : (
            <TournamentEmptyState title="Chưa có bảng xếp hạng" />
          )}
        </Paper>
      ) : null}

      {tab === "bracket" ? (
        <Paper sx={{ p: 2 }}>
          {!dashboard.bracket?.drawPublished ? (
            <Alert severity="info">Bốc thăm chưa công bố — nhánh chưa công khai.</Alert>
          ) : !dashboard.bracket.hasBracket ? (
            <TournamentEmptyState
              title="Chưa có nhánh knockout"
              description="Vòng bảng đang diễn ra hoặc chưa tạo bracket."
            />
          ) : (
            <Stack spacing={1}>
              <Typography fontWeight={700}>
                Nhánh knockout · {dashboard.bracket.roundCount} vòng ·{" "}
                {dashboard.bracket.knockoutMatchCount} trận
              </Typography>
              {dashboard.bracket.final ? (
                <Typography variant="body2">
                  Chung kết: {entryLabels[dashboard.bracket.final.entryAId] || "TBD"} vs{" "}
                  {entryLabels[dashboard.bracket.final.entryBId] || "TBD"} (
                  {dashboard.bracket.final.status})
                </Typography>
              ) : null}
              {dashboard.bracket.thirdPlace ? (
                <Typography variant="body2">
                  Hạng 3: {entryLabels[dashboard.bracket.thirdPlace.entryAId] || "TBD"} vs{" "}
                  {entryLabels[dashboard.bracket.thirdPlace.entryBId] || "TBD"}
                </Typography>
              ) : null}
              <Button
                component={RouterLink}
                to={`/tournament/bracket?tournamentId=${encodeURIComponent(dashboard.tournament.id)}`}
                sx={touchButtonSx}
              >
                Xem sơ đồ đầy đủ
              </Button>
            </Stack>
          )}
        </Paper>
      ) : null}

      {tab === "awards" ? (
        <Stack spacing={2}>
          <PlayerFinalResultsPanel tournament={tournament} eventId={dashboard.event.id} />
          {(dashboard.awards?.awards || []).length === 0 ? (
            <TournamentEmptyState
              title="Chưa có giải thưởng"
              description="Sau khi giải đóng, huy chương sẽ hiện tại đây."
            />
          ) : null}
        </Stack>
      ) : null}

      {tab === "history" ? (
        <Paper sx={{ p: 2 }}>
          {(dashboard.matchHistory || []).length === 0 ? (
            <TournamentEmptyState title="Chưa có lịch sử trận" />
          ) : (
            <List dense>
              {dashboard.matchHistory.map((match) => (
                <ListItem key={match.id} divider>
                  <ListItemText
                    primary={`${match.scoreLabel} · ${
                      match.didWin ? "Thắng" : "Thua"
                    }`}
                    secondary={`${match.resultType || match.status} · ${match.id}`}
                  />
                  <Chip
                    size="small"
                    color={match.didWin ? "success" : "default"}
                    label={match.didWin ? "W" : "L"}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      ) : null}

      {tab === "notifications" ? (
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography fontWeight={700}>Thông báo ({unreadCount} chưa đọc)</Typography>
            <Button size="small" onClick={onMarkAllRead} disabled={unreadCount === 0} sx={touchButtonSx}>
              Đánh dấu đã đọc
            </Button>
          </Stack>
          {notifications.length === 0 ? (
            <TournamentEmptyState title="Không có thông báo" />
          ) : (
            <List>
              {notifications.map((n) => (
                <ListItem
                  key={n.id}
                  divider
                  secondaryAction={
                    <Button size="small" onClick={() => onDismissNotification?.(n.id)}>
                      Ẩn
                    </Button>
                  }
                  sx={{ bgcolor: n.read ? "transparent" : "action.selected" }}
                >
                  <ListItemText
                    primary={n.title}
                    secondary={`${n.body}${n.timestamp ? ` · ${formatWhen(n.timestamp)}` : ""}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      ) : null}
    </Stack>
  );
}
