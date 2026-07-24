/**
 * Customer communication channel codes (business contract).
 *
 * String values intentionally align with CRM CONSENT_CHANNEL and Notification
 * EMAIL/SMS surfaces for interoperability. Customer Management does not import
 * CRM or Notification internals (dependency direction: others → Customer).
 */

export const CUSTOMER_COMMUNICATION_CHANNEL = Object.freeze({
  EMAIL: "EMAIL",
  SMS: "SMS",
  PHONE: "PHONE",
  PUSH: "PUSH",
});

export const CUSTOMER_COMMUNICATION_CHANNEL_VALUES = Object.freeze(
  Object.values(CUSTOMER_COMMUNICATION_CHANNEL)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerCommunicationChannel(value) {
  return CUSTOMER_COMMUNICATION_CHANNEL_VALUES.includes(String(value || ""));
}
