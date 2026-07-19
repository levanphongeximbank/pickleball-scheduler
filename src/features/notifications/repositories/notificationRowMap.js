/**
 * Map between domain inbox records and Supabase notification_inbox rows.
 */

export function rowToInboxRecord(row) {
  if (!row) return null;
  const id = row.id;
  return {
    notificationId: id,
    id,
    eventId: row.event_id,
    eventType: row.event_type,
    category: row.category,
    priority: row.priority,
    tenantId: row.tenant_id,
    venueId: row.venue_id ?? null,
    clubId: row.club_id ?? null,
    competitionId: row.competition_id ?? null,
    recipientUserId: row.recipient_user_id ? String(row.recipient_user_id) : null,
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    title: row.title || "",
    message: row.message || "",
    status: row.status,
    readAt: row.read_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    idempotencyKey: row.idempotency_key,
    sourceEntityType: row.source_entity_type ?? null,
    sourceEntityId: row.source_entity_id ?? null,
    metadata: row.metadata && typeof row.metadata === "object" ? { ...row.metadata } : {},
    payload: row.metadata?.payload && typeof row.metadata.payload === "object"
      ? { ...row.metadata.payload }
      : {},
    recipientHints: row.metadata?.recipientHints || { userIds: [], roles: [], entryIds: [] },
  };
}

export function inboxRecordToRpcArgs(record) {
  return {
    p_event_id: record.eventId || record.event_id || null,
    p_event_type: record.eventType,
    p_category: record.category,
    p_priority: record.priority,
    p_tenant_id: record.tenantId,
    p_venue_id: record.venueId || null,
    p_club_id: record.clubId || null,
    p_competition_id: record.competitionId || null,
    p_recipient_user_id: record.recipientUserId || null,
    p_actor_user_id: record.actorUserId || null,
    p_title: record.title || "",
    p_message: record.message || "",
    p_idempotency_key: record.idempotencyKey,
    p_source_entity_type: record.sourceEntityType || null,
    p_source_entity_id: record.sourceEntityId || null,
    p_metadata: {
      ...(record.metadata && typeof record.metadata === "object" ? record.metadata : {}),
      payload: record.payload || {},
      recipientHints: record.recipientHints || { userIds: [], roles: [], entryIds: [] },
    },
  };
}

export function rowToDeliveryJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    notificationId: row.notification_id,
    tenantId: row.tenant_id,
    channel: row.channel,
    status: row.status,
    attempts: row.attempts ?? 0,
    maxAttempts: row.max_attempts ?? 5,
    priority: row.priority ?? 100,
    lastError: row.last_error ?? null,
    providerMessageId: row.provider_message_id ?? null,
    scheduledAt: row.scheduled_at,
    nextAttemptAt: row.next_attempt_at ?? row.scheduled_at ?? null,
    workerId: row.worker_id ?? null,
    claimedAt: row.claimed_at ?? null,
    leaseExpiresAt: row.lease_expires_at ?? null,
    claimToken: row.claim_token ?? null,
    deliveryMode: row.delivery_mode ?? null,
    deliveryIdempotencyKey: row.delivery_idempotency_key ?? null,
    processedAt: row.processed_at ?? null,
    environment: row.environment ?? null,
    runNamespace: row.run_namespace ?? null,
    jobSource: row.job_source ?? null,
    cancelRequested: !!row.cancel_requested,
    cancelledAt: row.cancelled_at ?? null,
    cancelledBy: row.cancelled_by ?? null,
    cancellationReason: row.cancellation_reason ?? null,
    replayedFromJobId: row.replayed_from_job_id ?? null,
    replayRequestedBy: row.replay_requested_by ?? null,
    replayReason: row.replay_reason ?? null,
    replayGeneration: row.replay_generation ?? 0,
    recoveryCount: row.recovery_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToDeliveryAttempt(row) {
  if (!row) return null;
  return {
    attemptId: row.id,
    jobId: row.job_id,
    attemptNumber: row.attempt_number,
    workerId: row.worker_id,
    channel: row.channel,
    provider: row.provider,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
    result: row.result,
    errorCode: row.error_code ?? null,
    sanitizedErrorMessage: row.sanitized_error_message ?? null,
    retryable: !!row.retryable,
    nextAttemptAt: row.next_attempt_at ?? null,
    providerMessageId: row.provider_message_id ?? null,
    deliveryMode: row.delivery_mode ?? "sandbox",
    environment: row.environment ?? null,
    createdAt: row.created_at,
  };
}

export function rowToWorkerRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    runId: row.run_id,
    workerId: row.worker_id,
    environment: row.environment,
    runNamespace: row.run_namespace ?? null,
    tenantId: row.tenant_id ?? null,
    jobSource: row.job_source ?? null,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
    heartbeatAt: row.heartbeat_at,
    claimedCount: row.claimed_count ?? 0,
    sentCount: row.sent_count ?? 0,
    retryScheduledCount: row.retry_scheduled_count ?? 0,
    failedCount: row.failed_count ?? 0,
    deadLetteredCount: row.dead_lettered_count ?? 0,
    cancelledCount: row.cancelled_count ?? 0,
    skippedCount: row.skipped_count ?? 0,
    sanitizedErrorCount: row.sanitized_error_count ?? 0,
    durationMs: row.duration_ms ?? null,
    batchSize: row.batch_size ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
