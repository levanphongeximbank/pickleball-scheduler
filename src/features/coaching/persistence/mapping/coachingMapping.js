/**
 * Deterministic Coaching domain ↔ row mapping (COACHING-02).
 * Snake_case persistence rows; camelCase domain aggregates.
 * No Supabase types. No raw row passthrough as domain objects.
 */

function freezeDeep(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => freezeDeep(item)));
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(value)) {
    out[key] = freezeDeep(value[key]);
  }
  return Object.freeze(out);
}

function baseFromRow(row, idField, idColumn) {
  return {
    [idField]: row[idColumn],
    tenantId: row.tenant_id,
    clubId: row.club_id,
    venueId: row.venue_id ?? null,
    status: row.status,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function baseToRow(entity, idField, idColumn) {
  return {
    [idColumn]: entity[idField],
    tenant_id: entity.tenantId,
    club_id: entity.clubId,
    venue_id: entity.venueId ?? null,
    status: entity.status,
    version: entity.version,
    created_at: entity.createdAt,
    updated_at: entity.updatedAt,
  };
}

export function mapProgramRowToDomain(row) {
  return freezeDeep({
    ...baseFromRow(row, "programId", "program_id"),
    name: row.name,
    description: row.description ?? null,
    curriculumId: row.curriculum_id ?? null,
  });
}

export function mapProgramDomainToRow(entity) {
  return {
    ...baseToRow(entity, "programId", "program_id"),
    name: entity.name,
    description: entity.description ?? null,
    curriculum_id: entity.curriculumId ?? null,
  };
}

export function mapCoachReferenceRowToDomain(row) {
  return freezeDeep({
    ...baseFromRow(row, "coachReferenceId", "coach_reference_id"),
    coachPrincipalId: row.coach_principal_id,
    coachMembershipId: row.coach_membership_id ?? null,
    displayLabel: row.display_label ?? null,
  });
}

export function mapCoachReferenceDomainToRow(entity) {
  return {
    ...baseToRow(entity, "coachReferenceId", "coach_reference_id"),
    coach_principal_id: entity.coachPrincipalId,
    coach_membership_id: entity.coachMembershipId ?? null,
    display_label: entity.displayLabel ?? null,
  };
}

export function mapRelationshipRowToDomain(row) {
  return freezeDeep({
    ...baseFromRow(row, "relationshipId", "relationship_id"),
    coachReferenceId: row.coach_reference_id,
    playerId: row.player_id,
    programId: row.program_id ?? null,
  });
}

export function mapRelationshipDomainToRow(entity) {
  return {
    ...baseToRow(entity, "relationshipId", "relationship_id"),
    coach_reference_id: entity.coachReferenceId,
    player_id: entity.playerId,
    program_id: entity.programId ?? null,
  };
}

export function mapEnrollmentRowToDomain(row) {
  return freezeDeep({
    ...baseFromRow(row, "enrollmentId", "enrollment_id"),
    programId: row.program_id,
    playerId: row.player_id,
    coachReferenceId: row.coach_reference_id ?? null,
    packageId: row.package_id ?? null,
    entitlementId: row.entitlement_id ?? null,
  });
}

export function mapEnrollmentDomainToRow(entity) {
  return {
    ...baseToRow(entity, "enrollmentId", "enrollment_id"),
    program_id: entity.programId,
    player_id: entity.playerId,
    coach_reference_id: entity.coachReferenceId ?? null,
    package_id: entity.packageId ?? null,
    entitlement_id: entity.entitlementId ?? null,
  };
}

export function mapCurriculumRowToDomain(row) {
  return freezeDeep({
    ...baseFromRow(row, "curriculumId", "curriculum_id"),
    programId: row.program_id ?? null,
    name: row.name,
    description: row.description ?? null,
  });
}

export function mapCurriculumDomainToRow(entity) {
  return {
    ...baseToRow(entity, "curriculumId", "curriculum_id"),
    program_id: entity.programId ?? null,
    name: entity.name,
    description: entity.description ?? null,
  };
}

export function mapLessonRowToDomain(row) {
  return freezeDeep({
    ...baseFromRow(row, "lessonId", "lesson_id"),
    curriculumId: row.curriculum_id,
    title: row.title,
    sequence: Number(row.sequence),
    objectives: row.objectives ?? null,
  });
}

export function mapLessonDomainToRow(entity) {
  return {
    ...baseToRow(entity, "lessonId", "lesson_id"),
    curriculum_id: entity.curriculumId,
    title: entity.title,
    sequence: entity.sequence,
    objectives: entity.objectives ?? null,
  };
}

export function mapSessionRowToDomain(row) {
  const hasSchedule =
    row.schedule_starts_at != null || row.schedule_ends_at != null;
  return freezeDeep({
    ...baseFromRow(row, "sessionId", "session_id"),
    programId: row.program_id,
    lessonId: row.lesson_id ?? null,
    coachReferenceId: row.coach_reference_id ?? null,
    enrollmentId: row.enrollment_id ?? null,
    schedule: hasSchedule
      ? {
          startsAt: row.schedule_starts_at,
          endsAt: row.schedule_ends_at,
          venueId: row.schedule_venue_id ?? null,
          courtId: row.schedule_court_id ?? null,
          timezone: row.schedule_timezone ?? null,
        }
      : null,
    notes: row.notes ?? null,
  });
}

export function mapSessionDomainToRow(entity) {
  const schedule = entity.schedule || null;
  return {
    ...baseToRow(entity, "sessionId", "session_id"),
    program_id: entity.programId,
    lesson_id: entity.lessonId ?? null,
    coach_reference_id: entity.coachReferenceId ?? null,
    enrollment_id: entity.enrollmentId ?? null,
    schedule_starts_at: schedule?.startsAt ?? null,
    schedule_ends_at: schedule?.endsAt ?? null,
    schedule_venue_id: schedule?.venueId ?? null,
    schedule_court_id: schedule?.courtId ?? null,
    schedule_timezone: schedule?.timezone ?? null,
    notes: entity.notes ?? null,
  };
}

export function mapAttendanceRowToDomain(row) {
  return freezeDeep({
    ...baseFromRow(row, "attendanceId", "attendance_id"),
    sessionId: row.session_id,
    playerId: row.player_id,
    enrollmentId: row.enrollment_id ?? null,
    recordedByActorId: row.recorded_by_actor_id ?? null,
    notes: row.notes ?? null,
  });
}

export function mapAttendanceDomainToRow(entity) {
  return {
    ...baseToRow(entity, "attendanceId", "attendance_id"),
    session_id: entity.sessionId,
    player_id: entity.playerId,
    enrollment_id: entity.enrollmentId ?? null,
    recorded_by_actor_id: entity.recordedByActorId ?? null,
    notes: entity.notes ?? null,
  };
}

export function mapCorrectionRowToDomain(row) {
  return freezeDeep({
    correctionId: row.correction_id,
    tenantId: row.tenant_id,
    clubId: row.club_id,
    venueId: row.venue_id ?? null,
    attendanceId: row.attendance_id,
    previousStatus: row.previous_status,
    correctedStatus: row.corrected_status,
    reason: row.reason,
    actorId: row.actor_id,
    correctedAt: row.corrected_at,
    createdAt: row.created_at,
    version: Number(row.version),
  });
}

export function mapCorrectionDomainToRow(entity) {
  return {
    correction_id: entity.correctionId,
    tenant_id: entity.tenantId,
    club_id: entity.clubId,
    venue_id: entity.venueId ?? null,
    attendance_id: entity.attendanceId,
    previous_status: entity.previousStatus,
    corrected_status: entity.correctedStatus,
    reason: entity.reason,
    actor_id: entity.actorId,
    corrected_at: entity.correctedAt,
    created_at: entity.createdAt,
    version: entity.version ?? 1,
  };
}

export function mapPackageRowToDomain(row) {
  return freezeDeep({
    ...baseFromRow(row, "packageId", "package_id"),
    name: row.name,
    description: row.description ?? null,
    sessionEntitlement: Number(row.session_entitlement),
    validityDays: row.validity_days == null ? null : Number(row.validity_days),
    externalPaymentReference: row.external_payment_reference ?? null,
  });
}

export function mapPackageDomainToRow(entity) {
  return {
    ...baseToRow(entity, "packageId", "package_id"),
    name: entity.name,
    description: entity.description ?? null,
    session_entitlement: entity.sessionEntitlement,
    validity_days: entity.validityDays ?? null,
    external_payment_reference: entity.externalPaymentReference ?? null,
  };
}

export function mapEntitlementRowToDomain(row) {
  return freezeDeep({
    ...baseFromRow(row, "entitlementId", "entitlement_id"),
    packageId: row.package_id,
    playerId: row.player_id,
    enrollmentId: row.enrollment_id ?? null,
    sessionsGranted: Number(row.sessions_granted),
    sessionsConsumed: Number(row.sessions_consumed),
    sessionsRemaining: Number(row.sessions_remaining),
    validFrom: row.valid_from ?? null,
    validTo: row.valid_to ?? null,
    externalPaymentReference: row.external_payment_reference ?? null,
  });
}

export function mapEntitlementDomainToRow(entity) {
  return {
    ...baseToRow(entity, "entitlementId", "entitlement_id"),
    package_id: entity.packageId,
    player_id: entity.playerId,
    enrollment_id: entity.enrollmentId ?? null,
    sessions_granted: entity.sessionsGranted,
    sessions_consumed: entity.sessionsConsumed,
    sessions_remaining: entity.sessionsRemaining,
    valid_from: entity.validFrom ?? null,
    valid_to: entity.validTo ?? null,
    external_payment_reference: entity.externalPaymentReference ?? null,
  };
}

export function mapUsageEventRowToDomain(row) {
  return freezeDeep({
    usageEventId: row.usage_event_id,
    tenantId: row.tenant_id,
    clubId: row.club_id,
    venueId: row.venue_id ?? null,
    entitlementId: row.entitlement_id,
    packageId: row.package_id,
    playerId: row.player_id,
    sessionsDelta: Number(row.sessions_delta),
    remainingAfter: Number(row.remaining_after),
    idempotencyKey: row.idempotency_key,
    actorId: row.actor_id ?? null,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
    version: Number(row.version),
  });
}

export function mapEvaluationRowToDomain(row) {
  return freezeDeep({
    ...baseFromRow(row, "evaluationId", "evaluation_id"),
    playerId: row.player_id,
    coachReferenceId: row.coach_reference_id ?? null,
    sessionId: row.session_id ?? null,
    programId: row.program_id ?? null,
    summary: row.summary ?? null,
    rating: row.rating == null ? null : Number(row.rating),
    revisesEvaluationId: row.revises_evaluation_id ?? null,
    submittedAt: row.submitted_at ?? null,
  });
}

export function mapEvaluationDomainToRow(entity) {
  return {
    ...baseToRow(entity, "evaluationId", "evaluation_id"),
    player_id: entity.playerId,
    coach_reference_id: entity.coachReferenceId ?? null,
    session_id: entity.sessionId ?? null,
    program_id: entity.programId ?? null,
    summary: entity.summary ?? null,
    rating: entity.rating ?? null,
    revises_evaluation_id: entity.revisesEvaluationId ?? null,
    submitted_at: entity.submittedAt ?? null,
  };
}
