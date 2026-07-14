import { useMemo, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";

import {
  Alert,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  Snackbar,
  LinearProgress,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import NotificationsIcon from "@mui/icons-material/Notifications";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { useTournamentEngineState } from "../../features/tournament-engine/hooks/useTournamentEngine.js";
import { groupWorkflowHistoryByDate } from "../../features/tournament-engine/hooks/workflowHistory.js";
import EngineSetupTab from "./engine/tabs/EngineSetupTab.jsx";
import EngineSeedTab from "./engine/tabs/EngineSeedTab.jsx";
import EngineDrawTab from "./engine/tabs/EngineDrawTab.jsx";
import EngineScheduleTab from "./engine/tabs/EngineScheduleTab.jsx";
import EngineCourtsTab from "./engine/tabs/EngineCourtsTab.jsx";
import EngineRankingTab from "./engine/tabs/EngineRankingTab.jsx";
import EngineLogsTab from "./engine/tabs/EngineLogsTab.jsx";
import PermissionGate from "../../components/auth/PermissionGate.jsx";
import TournamentPageHeader from "../../components/tournament/TournamentPageHeader.jsx";
import { tournamentCardSx } from "../../components/tournament/tournamentLayout.js";
import { PERMISSIONS } from "../../auth/permissions.js";
import {
  getPlatformEventSummary,
  getPlatformNotificationSummary,
  getUnreadNotificationCount,
  getWorkflowNotificationMessage,
  getWorkflowStageConfig,
  getWorkflowStatusLabel,
} from "./engine/workflowPreviewUtils.js";

const TAB_CONFIG = [
  { key: "setup", label: "Thiết lập" },
  { key: "seed", label: "Hạt giống" },
  { key: "draw", label: "Bốc thăm" },
  { key: "schedule", label: "Lịch đấu" },
  { key: "courts", label: "Sân" },
  { key: "ranking", label: "Xếp hạng" },
  { key: "logs", label: "Nhật ký AI" },
];

function resolveTabFromPath(pathname) {
  if (pathname.endsWith("/seed")) return "seed";
  if (pathname.endsWith("/draw")) return "draw";
  if (pathname.endsWith("/schedule")) return "schedule";
  if (pathname.endsWith("/courts")) return "courts";
  if (pathname.endsWith("/ranking")) return "ranking";
  if (pathname.endsWith("/logs")) return "logs";
  return "setup";
}

function tabPath(tournamentId, tabKey) {
  if (tabKey === "setup") {
    return `/tournaments/${tournamentId}/engine`;
  }
  return `/tournaments/${tournamentId}/${tabKey}`;
}

export default function TournamentEnginePage() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = resolveTabFromPath(location.pathname);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [notificationFilter, setNotificationFilter] = useState("all");

  const engine = useTournamentEngineState(tournamentId);
  const platformSummary = useMemo(() => {
    const participantCount = engine.engineState?.participants?.length || 0;
    const groupCount = engine.engineState?.groups?.length || 0;
    const matchCount = engine.matches?.length || 0;
    const hasRanking = Boolean(engine.engineState?.rankingResult);

    let recommendation = "Bắt đầu workflow Engine 4.0";
    let reason = "Chạy hạt giống → bốc thăm → lịch đấu → xếp hạng.";

    if (hasRanking) {
      recommendation = "Workflow hoàn tất";
      reason = `${participantCount} VĐV · ${groupCount} bảng · ${matchCount} trận.`;
    } else if (matchCount > 0) {
      recommendation = "Tiếp theo: cập nhật xếp hạng";
      reason = `${matchCount} trận đã lên lịch.`;
    } else if (groupCount > 0) {
      recommendation = "Tiếp theo: tạo lịch đấu";
      reason = `${groupCount} bảng đã bốc thăm.`;
    } else if (participantCount > 0) {
      recommendation = "Tiếp theo: bốc thăm";
      reason = `${participantCount} hạt giống sẵn sàng.`;
    }

    return {
      ok: true,
      data: {
        recommendation: { recommendation, reason },
      },
    };
  }, [engine.engineState, engine.matches]);

  const workflowHistoryGroups = useMemo(() => groupWorkflowHistoryByDate(engine.workflowHistory || []), [engine.workflowHistory]);

  const workflowStages = useMemo(() => getWorkflowStageConfig(engine.engineState, engine.matches), [engine.engineState, engine.matches]);

  const completedStageCount = useMemo(() => workflowStages.filter((stage) => stage.done).length, [workflowStages]);

  const workflowStatusLabel = useMemo(() => getWorkflowStatusLabel(completedStageCount), [completedStageCount]);

  const latestHistoryEntry = useMemo(() => {
    return (engine.workflowHistory || [])[0] || null;
  }, [engine.workflowHistory]);

  const platformEventSummaries = useMemo(() => {
    return (engine.platformEvents || []).slice(0, 5).map((event) => getPlatformEventSummary(event));
  }, [engine.platformEvents]);

  const platformNotificationSummaries = useMemo(() => {
    const notifications = (engine.platformNotifications || []).slice(0, 10).map((notification) => getPlatformNotificationSummary(notification));
    if (notificationFilter === "unread") {
      return notifications.filter((notification) => notification?.read !== true && notification?.status !== "read");
    }
    return notifications;
  }, [engine.platformNotifications, notificationFilter]);

  const unreadNotificationCount = useMemo(() => {
    return getUnreadNotificationCount(engine.platformNotifications || []);
  }, [engine.platformNotifications]);

  const nextWorkflowAction = useMemo(() => {
    if (!engine.engineState?.participants?.length) {
      return {
        label: "Next: generate seed and build the initial player pool.",
        tab: "seed",
      };
    }
    if (!engine.engineState?.groups?.length) {
      return {
        label: "Next: create the draw so the bracket structure is ready.",
        tab: "draw",
      };
    }
    if (!engine.matches?.length) {
      return {
        label: "Next: schedule matches and assign court slots.",
        tab: "schedule",
      };
    }
    if (!engine.engineState?.rankingResult) {
      return {
        label: "Next: publish the ranking snapshot for the current workflow.",
        tab: "ranking",
      };
    }
    return {
      label: "Next: review the latest workflow summary and export the plan.",
      tab: "setup",
    };
  }, [engine.engineState, engine.matches]);

  const handleTabChange = (_, tabKey) => {
    navigate(tabPath(tournamentId, tabKey));
  };

  useEffect(() => {
    if (!confirmClearHistory) return undefined;

    const timer = window.setTimeout(() => setConfirmClearHistory(false), 2500);
    return () => window.clearTimeout(timer);
  }, [confirmClearHistory]);

  useEffect(() => {
    if (!engine.platformNotifications?.length) {
      return undefined;
    }

    const latestNotification = engine.platformNotifications[engine.platformNotifications.length - 1];
    const message = getWorkflowNotificationMessage(latestNotification);
    setToastMessage(message);
    return undefined;
  }, [engine.platformNotifications]);

  const handleClearHistory = () => {
    if (confirmClearHistory) {
      engine.clearWorkflowHistory?.();
      setConfirmClearHistory(false);
      return;
    }

    setConfirmClearHistory(true);
  };

  const handleNotificationClick = (notification) => {
    if (notification?.read || notification?.status === "read") {
      return;
    }
    engine.markNotificationAsRead?.(notification.id);
  };

  if (!engine.tournament) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Không tìm thấy giải đấu.</Alert>
        <Button startIcon={<ArrowBackIcon />} sx={{ mt: 2 }} onClick={() => navigate("/tournament")}>
          Quay lại
        </Button>
      </Box>
    );
  }

  const tabContent = (() => {
    switch (activeTab) {
      case "seed":
        return <EngineSeedTab engine={engine} />;
      case "draw":
        return <EngineDrawTab engine={engine} />;
      case "schedule":
        return <EngineScheduleTab engine={engine} />;
      case "courts":
        return <EngineCourtsTab engine={engine} />;
      case "ranking":
        return <EngineRankingTab engine={engine} />;
      case "logs":
        return <EngineLogsTab tournamentId={tournamentId} />;
      default:
        return <EngineSetupTab engine={engine} tournamentId={tournamentId} />;
    }
  })();

  return (
    <PermissionGate
      permission={PERMISSIONS.TOURNAMENT_UPDATE}
      fallback={<Alert severity="warning">Bạn không có quyền cấu hình giải.</Alert>}
    >
      <Box sx={{ p: { xs: 1, md: 2 } }}>
        <Snackbar
          open={Boolean(toastMessage)}
          autoHideDuration={4000}
          onClose={() => setToastMessage("")}
          message={toastMessage}
        />
        <Breadcrumbs sx={{ mb: 1 }}>
          <Link component="button" underline="hover" color="inherit" onClick={() => navigate("/tournament")}>
            Giải đấu
          </Link>
          <Typography color="text.primary">{engine.tournament.name}</Typography>
          <Typography color="text.secondary">Engine 4.0</Typography>
        </Breadcrumbs>

        <TournamentPageHeader
          title="Tournament Engine 4.0"
          description={engine.tournament.name}
          action={<AutoAwesomeIcon color="primary" />}
        />

        <Box sx={{ mb: 2, p: 1.25, border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "background.paper" }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 1.25 }}>
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
                <Typography variant="subtitle2" color="primary">
                  Platform v5 Engine Preview
                </Typography>
                <Chip
                  size="small"
                  label={workflowStatusLabel}
                  color={completedStageCount === 4 ? "success" : completedStageCount > 0 ? "info" : "default"}
                  variant="outlined"
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.85rem" }}>
                {platformSummary.data.recommendation.recommendation} · {platformSummary.data.recommendation.reason}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="contained"
              color="primary"
              endIcon={<ArrowForwardIcon />}
              sx={{ py: 0.2, px: 1, fontSize: "0.8rem", fontWeight: 600 }}
              onClick={() => navigate(tabPath(tournamentId, nextWorkflowAction.tab))}
            >
              {nextWorkflowAction.label}
            </Button>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 0.75, mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Tiến độ workflow
            </Typography>
            <Typography variant="caption" color="primary">
              {completedStageCount}/4 stages
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(completedStageCount / 4) * 100}
            sx={{ height: 6, borderRadius: 999 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            {completedStageCount === 4
              ? "Tất cả các bước workflow đã hoàn tất."
              : completedStageCount > 0
                ? `Workflow đang ở ${completedStageCount}/4 bước. Hãy tiếp tục với bước tiếp theo.`
                : "Workflow chưa bắt đầu. Hãy bắt đầu từ bước đầu tiên."}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.75 }}>
            {workflowStages.map((stage, index) => {
              const isNextStage = !stage.done && workflowStages.findIndex((item) => !item.done) === index;
              return (
                <Box
                  key={stage.key}
                  component="button"
                  title={`Go to ${stage.label.toLowerCase()} workflow`}
                  onClick={() => navigate(tabPath(tournamentId, stage.tab))}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 999,
                    border: "1px solid",
                    borderColor: stage.done ? "success.main" : isNextStage ? "primary.main" : "divider",
                    bgcolor: stage.done ? "success.main" : isNextStage ? "primary.light" : "grey.100",
                    color: stage.done ? "common.white" : isNextStage ? "primary.contrastText" : "text.secondary",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    transition: "all 120ms ease-in-out",
                    "&:hover": {
                      transform: "translateY(-1px)",
                      boxShadow: 1,
                    },
                    "&:focus-visible": {
                      outline: "2px solid",
                      outlineColor: "primary.main",
                      outlineOffset: 1,
                    },
                  }}
                >
                  <Typography variant="caption" sx={{ color: "inherit" }}>
                    {stage.done ? "●" : isNextStage ? "▶" : "○"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "inherit" }}>
                    {stage.label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Paper sx={{ p: 1.5, mb: 1.5, bgcolor: "grey.50" }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 1, mb: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Platform event feed
            </Typography>
            <Chip size="small" label={`${platformEventSummaries.length} events`} variant="outlined" />
          </Box>
          {platformEventSummaries.length > 0 ? (
            <List dense disablePadding sx={{ mb: 1 }}>
              {platformEventSummaries.map((event, index) => (
                <ListItem key={`${event.title}-${index}`} disablePadding sx={{ py: 0.2 }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {event.title}
                        </Typography>
                        <Chip size="small" label={event.status} variant="outlined" />
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {`${event.detail} · ${new Date(event.timestamp).toLocaleString("vi-VN")}`}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Chưa có event nào được ghi nhận cho workflow này.
            </Typography>
          )}

          <Box sx={{ mt: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75, flexWrap: "wrap" }}>
              <Typography variant="subtitle2" color="text.secondary">
                Recent notifications
              </Typography>
              <Badge badgeContent={unreadNotificationCount} color="primary" max={99}>
                <NotificationsIcon color="action" fontSize="small" />
              </Badge>
              {unreadNotificationCount > 0 && (
                <Button size="small" variant="text" onClick={() => engine.markAllNotificationsAsRead?.()}>
                  Đánh dấu tất cả đã đọc
                </Button>
              )}
              <Button size="small" variant="text" color={notificationFilter === "all" ? "primary" : "inherit"} onClick={() => setNotificationFilter("all")}>
                Tất cả
              </Button>
              <Button size="small" variant="text" color={notificationFilter === "unread" ? "primary" : "inherit"} onClick={() => setNotificationFilter("unread")}>
                Chưa đọc
              </Button>
            </Box>
            {platformNotificationSummaries.length > 0 ? (
              <List dense disablePadding>
                {platformNotificationSummaries.map((notification, index) => (
                  <ListItem
                    key={`${notification.title}-${index}`}
                    disablePadding
                    sx={{
                      py: 0.2,
                      cursor: notification?.read || notification?.status === "read" ? "default" : "pointer",
                      bgcolor: notification?.read || notification?.status === "read" ? "transparent" : "primary.50",
                      borderRadius: 1,
                      border: notification?.read || notification?.status === "read" ? "1px solid transparent" : "1px solid",
                      borderColor: notification?.read || notification?.status === "read" ? "transparent" : "primary.100",
                    }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {notification.title}
                          </Typography>
                          {!notification?.read && notification?.status !== "read" && (
                            <Chip size="small" label="NEW" color="primary" variant="filled" />
                          )}
                          <Chip size="small" label={notification.channel} variant="outlined" />
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {`${notification.detail} · ${new Date(notification.timestamp).toLocaleString("vi-VN")}`}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Chưa có notification nào được tạo cho workflow này.
              </Typography>
            )}
          </Box>
        </Paper>

        {engine.workflowHistory?.length > 0 && (
          <Paper sx={{ p: 1.5, mb: 1.5, bgcolor: "grey.50" }}>
            {latestHistoryEntry && !historyExpanded && (
              <Box sx={{ mb: 0.75, p: 0.75, borderRadius: 1, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary">
                  Latest action
                </Typography>
                <Typography variant="body2" sx={{ textTransform: "capitalize", fontWeight: 600 }}>
                  {latestHistoryEntry.action}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {`${latestHistoryEntry.detail} · ${new Date(latestHistoryEntry.timestamp).toLocaleString("vi-VN")}`}
                </Typography>
              </Box>
            )}
            <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 1, mb: 0.75 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Workflow history
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}>
                <Chip size="small" label={`${engine.workflowHistory?.length || 0} entries`} variant="outlined" />
                <Button
                  size="small"
                  variant="text"
                  color={historyExpanded ? "primary" : "inherit"}
                  startIcon={historyExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  onClick={() => setHistoryExpanded((value) => !value)}
                >
                  {historyExpanded ? "Thu gọn" : "Mở rộng"}
                </Button>
                <Button size="small" variant="text" color={confirmClearHistory ? "warning" : "inherit"} onClick={handleClearHistory}>
                  {confirmClearHistory ? "Xác nhận" : "Xóa"}
                </Button>
              </Box>
            </Box>
            {historyExpanded && (
              <List dense disablePadding>
                {workflowHistoryGroups.slice(0, 3).map((group) => (
                  <Box key={group.label} sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                      {group.label}
                    </Typography>
                    {group.entries.slice(0, 3).map((entry) => {
                      const statusColor = entry.status === "success" ? "success" : entry.status === "error" ? "error" : "default";
                      return (
                        <ListItem key={entry.id} disablePadding sx={{ py: 0.1 }}>
                          <ListItemText
                            primary={
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                <Typography variant="body2" sx={{ textTransform: "capitalize", fontWeight: 600 }}>
                                  {entry.action}
                                </Typography>
                                <Chip size="small" label={entry.status} color={statusColor} variant="outlined" />
                              </Box>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                {`${entry.detail} · ${new Date(entry.timestamp).toLocaleString("vi-VN")}`}
                              </Typography>
                            }
                          />
                        </ListItem>
                      );
                    })}
                  </Box>
                ))}
              </List>
            )}
          </Paper>
        )}

        {engine.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {engine.error}
          </Alert>
        )}

        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
        >
          {TAB_CONFIG.map((tab) => (
            <Tab key={tab.key} label={tab.label} value={tab.key} />
          ))}
        </Tabs>

        {engine.loading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <CircularProgress size={20} />
            <Typography variant="body2">Đang xử lý…</Typography>
          </Box>
        )}

        {tabContent}
      </Box>
    </PermissionGate>
  );
}
