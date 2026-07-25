/**
 * Narrow Coaching database client port (COACHING-02).
 * Durable adapters depend on this port — never on a concrete Supabase singleton.
 * Injectable and testable. No module-global client. No live connection here.
 */

import { COACHING_ERROR_CODES } from "../constants/errorCodes.js";
import { CoachingError } from "../errors/CoachingError.js";

/**
 * @typedef {object} CoachingDatabaseClientPort
 * @property {(request: {
 *   table: string,
 *   columns?: string,
 *   filters?: object,
 *   order?: Array<{ column: string, ascending?: boolean }>,
 *   limit?: number,
 * }) => Promise<object[]>} select
 * @property {(request: {
 *   table: string,
 *   rows: object|object[],
 *   returning?: boolean,
 * }) => Promise<object[]>} insert
 * @property {(request: {
 *   table: string,
 *   values: object,
 *   filters: object,
 *   returning?: boolean,
 * }) => Promise<object[]>} update
 * @property {(request: {
 *   table: string,
 *   filters: object,
 * }) => Promise<number>} delete
 * @property {(request: {
 *   fn: string,
 *   args?: object,
 * }) => Promise<unknown>} rpc
 */

/**
 * @param {Partial<CoachingDatabaseClientPort>} client
 * @returns {CoachingDatabaseClientPort}
 */
export function requireCoachingDatabaseClientPort(client) {
  if (!client || typeof client !== "object") {
    throw new CoachingError(
      COACHING_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
      "CoachingDatabaseClientPort is required for durable Coaching persistence.",
      { adapter: "CoachingDatabaseClientPort" }
    );
  }
  for (const method of ["select", "insert", "update", "delete", "rpc"]) {
    if (typeof client[method] !== "function") {
      throw new CoachingError(
        COACHING_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
        `CoachingDatabaseClientPort.${method} must be a function.`,
        { adapter: "CoachingDatabaseClientPort", method }
      );
    }
  }
  return Object.freeze({
    select: client.select.bind(client),
    insert: client.insert.bind(client),
    update: client.update.bind(client),
    delete: client.delete.bind(client),
    rpc: client.rpc.bind(client),
  });
}

export const COACHING_02_TABLES = Object.freeze({
  PROGRAMS: "coaching_programs",
  COACH_REFERENCES: "coaching_coach_references",
  RELATIONSHIPS: "coaching_coach_player_relationships",
  ENROLLMENTS: "coaching_enrollments",
  CURRICULA: "coaching_curricula",
  LESSONS: "coaching_lessons",
  SESSIONS: "coaching_training_sessions",
  ATTENDANCE: "coaching_attendance_records",
  ATTENDANCE_CORRECTIONS: "coaching_attendance_corrections",
  PACKAGES: "coaching_packages",
  ENTITLEMENTS: "coaching_package_entitlements",
  USAGE_EVENTS: "coaching_package_usage_events",
  EVALUATIONS: "coaching_evaluations",
});

export const COACHING_02_RPC = Object.freeze({
  APPLY_ATTENDANCE_CORRECTION: "coaching_apply_attendance_correction",
  CONSUME_ENTITLEMENT: "coaching_consume_entitlement",
});
