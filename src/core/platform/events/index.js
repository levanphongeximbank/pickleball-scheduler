export const EVENT_TYPES = {
  WORKFLOW_STARTED: "workflow.started",
  WORKFLOW_COMPLETED: "workflow.completed",
  WORKFLOW_FAILED: "workflow.failed",
  AUDIT_LOGGED: "audit.logged",
  NOTIFICATION_SENT: "notification.sent",
};

export function createPlatformEvent({
  type,
  action,
  entityType = "workflow",
  entityId = null,
  metadata = {},
  actorId = null,
  tenantId = null,
} = {}) {
  return {
    id: `event-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    action,
    entityType,
    entityId,
    metadata,
    actorId,
    tenantId,
    occurredAt: new Date().toISOString(),
  };
}

export function createEventStore(initial = []) {
  const events = [...initial];

  return {
    list() {
      return [...events];
    },
    add(event) {
      events.push(event);
      return event;
    },
    latest() {
      return events[events.length - 1] || null;
    },
    clear() {
      events.length = 0;
    },
  };
}

export function createPlatformEventDispatcher({ auditService, notificationService } = {}) {
  return function dispatch(event, { tenantId = null, notify = false } = {}) {
    const normalizedStatus = event?.metadata?.status || "info";
    const auditEntry = auditService?.log?.({
      tenant_id: tenantId,
      action: `workflow.${event.action}`,
      target_id: event.entityId,
      metadata: {
        ...event.metadata,
        eventType: event.type,
        status: normalizedStatus,
      },
    });

    let notificationEntry = null;
    if (notify && notificationService?.create) {
      notificationEntry = notificationService.create({
        tenant_id: tenantId,
        channel: "in_app",
        title: `Workflow ${event.action} ${normalizedStatus}`,
        body: event.metadata?.detail || `Workflow ${event.action} ${normalizedStatus}`,
      });
    }

    return { event, auditEntry, notificationEntry };
  };
}
