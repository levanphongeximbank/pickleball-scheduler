export function getWorkflowStageConfig(engineState = {}, matches = []) {
  return [
    {
      key: "seed",
      label: "Seed",
      tab: "seed",
      done: Boolean(engineState?.participants?.length),
    },
    {
      key: "draw",
      label: "Draw",
      tab: "draw",
      done: Boolean(engineState?.groups?.length),
    },
    {
      key: "schedule",
      label: "Schedule",
      tab: "schedule",
      done: Boolean(matches?.length),
    },
    {
      key: "ranking",
      label: "Ranking",
      tab: "ranking",
      done: Boolean(engineState?.rankingResult),
    },
  ];
}

export function getWorkflowStatusLabel(completedStageCount) {
  if (completedStageCount >= 4) return "Completed";
  if (completedStageCount > 0) return "In progress";
  return "Ready";
}

export function getPlatformEventSummary(event = {}) {
  const actionLabel = (event.action || "workflow").replace(/-/g, " ");
  return {
    title: actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1),
    status: event.metadata?.status || "info",
    detail: event.metadata?.detail || event.action || "Workflow event",
    timestamp: event.occurredAt || event.timestamp || new Date().toISOString(),
  };
}

export function getPlatformNotificationSummary(notification = {}) {
  return {
    title: notification.title || "Workflow notification",
    detail: notification.body || notification.detail || "No details",
    timestamp: notification.created_at || notification.createdAt || new Date().toISOString(),
    channel: notification.channel || "in_app",
  };
}

export function getWorkflowNotificationMessage(notification = {}) {
  const summary = getPlatformNotificationSummary(notification);
  return `${summary.title}: ${summary.detail}`;
}

export function getUnreadNotificationCount(notifications = []) {
  return notifications.filter((notification) => {
    if (notification?.read === true || notification?.isRead === true) {
      return false;
    }
    return notification?.status !== "read";
  }).length;
}
