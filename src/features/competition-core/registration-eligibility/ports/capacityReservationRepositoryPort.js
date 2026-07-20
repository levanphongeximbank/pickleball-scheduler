/**
 * CapacityReservationRepositoryPort — active/released capacity reservations.
 * In-memory only for Phase 1D.
 *
 * @typedef {import('../contracts/capacity.js').CapacityReservation} CapacityReservation
 */

import { cloneJsonSafe } from "../contracts/shared.js";
import { createCapacityReservation } from "../contracts/capacity.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";

export const CAPACITY_RESERVATION_REPOSITORY_PORT_METHODS = Object.freeze([
  "getById",
  "findActiveByRegistrationId",
  "save",
  "listByCompetition",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCapacityReservationRepositoryPort(port) {
  if (!port || typeof port !== "object") return false;
  return CAPACITY_RESERVATION_REPOSITORY_PORT_METHODS.every(
    (name) => typeof /** @type {any} */ (port)[name] === "function"
  );
}

export function createInMemoryCapacityReservationRepositoryPort() {
  /** @type {Map<string, CapacityReservation>} */
  const byId = new Map();
  /** @type {Map<string, string>} */
  const activeByRegistration = new Map();

  /**
   * @param {CapacityReservation|null} reservation
   * @returns {CapacityReservation|null}
   */
  function cloneReservation(reservation) {
    return reservation
      ? /** @type {CapacityReservation} */ (cloneJsonSafe(reservation))
      : null;
  }

  return {
    async getById(reservationId) {
      return cloneReservation(byId.get(String(reservationId || "")) ?? null);
    },

    async findActiveByRegistrationId(registrationId) {
      const id = activeByRegistration.get(String(registrationId || ""));
      if (!id) return null;
      const reservation = byId.get(id);
      if (!reservation || reservation.status !== "ACTIVE") return null;
      return cloneReservation(reservation);
    },

    /**
     * @param {CapacityReservation} reservation
     */
    async save(reservation) {
      const stored = createCapacityReservation(reservation);
      const existingActiveId = activeByRegistration.get(stored.registrationId);

      if (stored.status === "ACTIVE") {
        if (existingActiveId && existingActiveId !== stored.reservationId) {
          const err = new Error("DUPLICATE_ACTIVE_RESERVATION");
          err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_ACTIVE_RESERVATION;
          err.metadata = {
            registrationId: stored.registrationId,
            existingReservationId: existingActiveId,
            attemptedReservationId: stored.reservationId,
          };
          throw err;
        }
        activeByRegistration.set(stored.registrationId, stored.reservationId);
      } else if (existingActiveId === stored.reservationId) {
        activeByRegistration.delete(stored.registrationId);
      }

      byId.set(stored.reservationId, /** @type {CapacityReservation} */ (cloneJsonSafe(stored)));
      return cloneReservation(byId.get(stored.reservationId) ?? null);
    },

    async listByCompetition(competitionId) {
      const id = String(competitionId || "");
      return [...byId.values()]
        .filter((r) => r.competitionId === id)
        .map((r) => cloneReservation(r));
    },
  };
}

export function createNullCapacityReservationRepositoryPort() {
  return {
    async getById() {
      throw new TypeError("NullCapacityReservationRepositoryPort cannot getById");
    },
    async findActiveByRegistrationId() {
      throw new TypeError(
        "NullCapacityReservationRepositoryPort cannot findActiveByRegistrationId"
      );
    },
    async save() {
      throw new TypeError("NullCapacityReservationRepositoryPort cannot save");
    },
    async listByCompetition() {
      throw new TypeError("NullCapacityReservationRepositoryPort cannot listByCompetition");
    },
  };
}
