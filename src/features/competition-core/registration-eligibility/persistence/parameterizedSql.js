/**
 * Phase 1F — parameterized SQL builders for Core-03 persistence.
 *
 * Produces { text, values } plans only. Never interpolates request values into SQL text.
 * Does not open database connections.
 */

/**
 * @typedef {Object} ParameterizedSqlStatement
 * @property {string} text
 * @property {unknown[]} values
 * @property {string} purpose
 */

/**
 * @param {string} text
 * @param {unknown[]} values
 * @param {string} purpose
 * @returns {ParameterizedSqlStatement}
 */
export function createParameterizedSqlStatement(text, values, purpose) {
  if (typeof text !== "string" || !text.trim()) {
    throw new TypeError("SQL text is required");
  }
  if (!Array.isArray(values)) {
    throw new TypeError("SQL values must be an array");
  }
  // Reject accidental interpolation patterns that embed raw quotes adjacent to values.
  if (/\$\{/.test(text) || /'\s*\+\s*/.test(text)) {
    throw new TypeError("SQL text must not use template/string concatenation interpolation");
  }
  return Object.freeze({
    text: String(text).trim(),
    values: values.slice(),
    purpose: String(purpose || "unknown"),
  });
}

/**
 * Insert registration row — placeholders only.
 * @param {Record<string, unknown>} row
 * @returns {ParameterizedSqlStatement}
 */
export function buildInsertRegistrationSql(row) {
  return createParameterizedSqlStatement(
    `INSERT INTO public.core03_competition_registrations (
      id, registration_request_id, idempotency_key, competition_id, division_id,
      status, target_type, target_stable_identity, identity_key, applicant_json,
      target_json, lifecycle_timestamps_json, state_version, source_version,
      created_at, updated_at, correlation_id, request_id, handoff_pending, payload_json
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
    )`,
    [
      row.id,
      row.registrationRequestId,
      row.idempotencyKey ?? null,
      row.competitionId,
      row.divisionId ?? null,
      row.status,
      row.targetType,
      row.targetStableIdentity,
      row.identityKey ?? null,
      row.applicantJson ?? null,
      row.targetJson ?? null,
      row.lifecycleTimestampsJson ?? null,
      row.stateVersion ?? 0,
      row.sourceVersion ?? null,
      row.createdAt ?? null,
      row.updatedAt ?? null,
      row.correlationId ?? null,
      row.requestId ?? null,
      row.handoffPending === true,
      row.payloadJson ?? null,
    ],
    "insert-registration"
  );
}

/**
 * @param {string} registrationId
 * @returns {ParameterizedSqlStatement}
 */
export function buildSelectRegistrationByIdSql(registrationId) {
  return createParameterizedSqlStatement(
    `SELECT * FROM public.core03_competition_registrations WHERE id = $1`,
    [registrationId],
    "select-registration-by-id"
  );
}

/**
 * @param {Record<string, unknown>} row
 * @returns {ParameterizedSqlStatement}
 */
export function buildInsertAuditEventSql(row) {
  return createParameterizedSqlStatement(
    `INSERT INTO public.core03_registration_audit_events (
      id, registration_id, competition_id, division_id, event_type, operation,
      actor_id, from_status, to_status, decision_id, eligibility_decision_id,
      capacity_snapshot_id, reservation_id, waitlist_entry_id, reason_codes,
      request_id, correlation_id, service_version, occurred_at,
      reconciliation_required, partial_success_json, payload_json
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
    )`,
    [
      row.id,
      row.registrationId,
      row.competitionId ?? null,
      row.divisionId ?? null,
      row.eventType,
      row.operation ?? null,
      row.actorId ?? null,
      row.fromStatus ?? null,
      row.toStatus ?? null,
      row.decisionId ?? null,
      row.eligibilityDecisionId ?? null,
      row.capacitySnapshotId ?? null,
      row.reservationId ?? null,
      row.waitlistEntryId ?? null,
      row.reasonCodes ?? [],
      row.requestId ?? null,
      row.correlationId ?? null,
      row.serviceVersion ?? null,
      row.occurredAt,
      row.reconciliationRequired === true,
      row.partialSuccessJson ?? null,
      row.payloadJson ?? null,
    ],
    "insert-audit-event"
  );
}

/**
 * Static audit helper — true when statement uses only $n placeholders for values.
 * @param {ParameterizedSqlStatement} statement
 * @returns {boolean}
 */
export function isSafeParameterizedStatement(statement) {
  if (!statement || typeof statement.text !== "string" || !Array.isArray(statement.values)) {
    return false;
  }
  const placeholders = statement.text.match(/\$\d+/g) || [];
  if (placeholders.length !== statement.values.length) return false;
  // No single-quoted literals that look like injected ids adjacent to dynamic content.
  if (/'\s*\|\|/.test(statement.text)) return false;
  if (/\$\{/.test(statement.text)) return false;
  return true;
}
