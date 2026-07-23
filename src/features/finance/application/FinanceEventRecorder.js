/**
 * FinanceEventRecorder — records approved Finance event envelopes after
 * successful application commands. Not an external event bus.
 */

import { createFinanceEvent } from "../events/envelope.js";
import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";

/**
 * @param {object} deps
 * @param {object} deps.eventRepository
 * @param {() => string} deps.idGenerator
 */
export function createFinanceEventRecorder(deps = {}) {
  const eventRepository = deps.eventRepository;
  const idGenerator = deps.idGenerator;

  if (!eventRepository || typeof eventRepository.append !== "function") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "eventRepository.append is required.",
      { field: "eventRepository" }
    );
  }
  if (typeof idGenerator !== "function") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "idGenerator is required for FinanceEventRecorder.",
      { field: "idGenerator" }
    );
  }

  return {
    /**
     * Record one Finance event. Callers must supply a command-scoped
     * eventIdempotencyKey so idempotent replays do not append twice.
     *
     * @param {object} input
     * @returns {Readonly<object>}
     */
    record(input = {}) {
      const eventIdempotencyKey =
        input.eventIdempotencyKey || input.idempotencyKey;
      if (
        typeof eventIdempotencyKey === "string" &&
        eventIdempotencyKey.trim()
      ) {
        const existing = eventRepository.findByIdempotencyKey?.(
          input.tenantId,
          eventIdempotencyKey.trim()
        );
        if (existing) {
          return existing;
        }
      }

      const event = createFinanceEvent({
        ...input,
        eventId: input.eventId || idGenerator("event"),
        idempotencyKey: eventIdempotencyKey,
      });
      return eventRepository.append(event);
    },
  };
}
