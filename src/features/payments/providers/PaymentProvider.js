/**
 * @typedef {Object} CreatePaymentInput
 * @property {string} tenantId
 * @property {string} orderId
 * @property {number} amount
 * @property {string} currency
 * @property {string} idempotencyKey
 * @property {Object} metadata
 */

/**
 * @typedef {Object} CreatePaymentResult
 * @property {boolean} ok
 * @property {string} [providerTransactionId]
 * @property {string} [paymentUrl]
 * @property {Object} [rawResponse]
 * @property {string} [error]
 */

export class PaymentProvider {
  constructor(name) {
    this.name = name;
  }

  /** @param {CreatePaymentInput} input */
  async createPayment() {
    throw new Error("createPayment not implemented");
  }

  /** @param {Object} input */
  async verifyCallback() {
    throw new Error("verifyCallback not implemented");
  }

  /** @param {Object} input */
  async refund() {
    throw new Error("refund not implemented");
  }
}
