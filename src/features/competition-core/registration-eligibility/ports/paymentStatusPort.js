/**
 * PaymentStatusPort — payment requirement checks (not payment processing ownership).
 *
 * @typedef {Object} PaymentStatusPort
 * @property {(args: {
 *   competitionId: string,
 *   registrationId?: string|null,
 *   participantId?: string|null,
 *   teamId?: string|null,
 * }) => Promise<{
 *   status: 'PAID'|'UNPAID'|'WAIVED'|'UNKNOWN'|'NOT_REQUIRED',
 *   requirementMet: boolean,
 *   reference?: string|null,
 * }>} getPaymentStatus
 */

/**
 * @returns {PaymentStatusPort}
 */
export function createNullPaymentStatusPort() {
  return {
    async getPaymentStatus() {
      return {
        status: "UNKNOWN",
        requirementMet: false,
        reference: null,
      };
    },
  };
}

/**
 * @param {(args: any) => any|Promise<any>} [impl]
 * @returns {PaymentStatusPort}
 */
export function createStubPaymentStatusPort(impl) {
  return {
    async getPaymentStatus(args) {
      if (typeof impl === "function") return impl(args);
      return { status: "NOT_REQUIRED", requirementMet: true, reference: null };
    },
  };
}

export const PAYMENT_STATUS_PORT_METHODS = Object.freeze(["getPaymentStatus"]);
