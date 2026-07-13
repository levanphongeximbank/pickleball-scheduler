import { SCHEDULING_STRATEGY } from "./schedulingConstants.js";

/**
 * @typedef {Object} StrategyCapabilities
 * @property {boolean} supportsCourts
 * @property {boolean} supportsTimeSlots
 * @property {boolean} supportsByes
 * @property {boolean} supportsRestRules
 * @property {boolean} supportsVenues
 * @property {boolean} supportsManualOverrides
 * @property {boolean} supportsReferees
 * @property {boolean} supportsRescheduling
 * @property {boolean} runtimeSupported
 */

/** @type {Record<string, StrategyCapabilities>} */
export const STRATEGY_CAPABILITIES = Object.freeze({
  [SCHEDULING_STRATEGY.ROUND_ROBIN]: {
    supportsCourts: false,
    supportsTimeSlots: false,
    supportsByes: true,
    supportsRestRules: false,
    supportsVenues: false,
    supportsManualOverrides: true,
    supportsReferees: false,
    supportsRescheduling: false,
    runtimeSupported: true,
  },
  [SCHEDULING_STRATEGY.GROUP_STAGE]: {
    supportsCourts: true,
    supportsTimeSlots: true,
    supportsByes: true,
    supportsRestRules: true,
    supportsVenues: true,
    supportsManualOverrides: true,
    supportsReferees: true,
    supportsRescheduling: true,
    runtimeSupported: true,
  },
  [SCHEDULING_STRATEGY.KNOCKOUT]: {
    supportsCourts: true,
    supportsTimeSlots: true,
    supportsByes: false,
    supportsRestRules: true,
    supportsVenues: true,
    supportsManualOverrides: true,
    supportsReferees: true,
    supportsRescheduling: true,
    runtimeSupported: false,
  },
  [SCHEDULING_STRATEGY.DOUBLE_ELIMINATION]: {
    supportsCourts: true,
    supportsTimeSlots: true,
    supportsByes: false,
    supportsRestRules: true,
    supportsVenues: true,
    supportsManualOverrides: true,
    supportsReferees: true,
    supportsRescheduling: true,
    runtimeSupported: false,
  },
  [SCHEDULING_STRATEGY.SWISS]: {
    supportsCourts: true,
    supportsTimeSlots: true,
    supportsByes: false,
    supportsRestRules: true,
    supportsVenues: true,
    supportsManualOverrides: true,
    supportsReferees: false,
    supportsRescheduling: false,
    runtimeSupported: false,
  },
  [SCHEDULING_STRATEGY.TEAM_TOURNAMENT]: {
    supportsCourts: true,
    supportsTimeSlots: true,
    supportsByes: false,
    supportsRestRules: true,
    supportsVenues: true,
    supportsManualOverrides: true,
    supportsReferees: true,
    supportsRescheduling: true,
    runtimeSupported: true,
  },
  [SCHEDULING_STRATEGY.COURT_FIRST]: {
    supportsCourts: true,
    supportsTimeSlots: false,
    supportsByes: false,
    supportsRestRules: false,
    supportsVenues: true,
    supportsManualOverrides: true,
    supportsReferees: false,
    supportsRescheduling: false,
    runtimeSupported: false,
  },
  [SCHEDULING_STRATEGY.TIME_FIRST]: {
    supportsCourts: false,
    supportsTimeSlots: true,
    supportsByes: false,
    supportsRestRules: true,
    supportsVenues: true,
    supportsManualOverrides: true,
    supportsReferees: false,
    supportsRescheduling: false,
    runtimeSupported: false,
  },
  [SCHEDULING_STRATEGY.BALANCED]: {
    supportsCourts: true,
    supportsTimeSlots: true,
    supportsByes: true,
    supportsRestRules: true,
    supportsVenues: true,
    supportsManualOverrides: true,
    supportsReferees: true,
    supportsRescheduling: true,
    runtimeSupported: true,
  },
  [SCHEDULING_STRATEGY.MANUAL]: {
    supportsCourts: true,
    supportsTimeSlots: true,
    supportsByes: true,
    supportsRestRules: false,
    supportsVenues: true,
    supportsManualOverrides: true,
    supportsReferees: true,
    supportsRescheduling: true,
    runtimeSupported: false,
  },
  [SCHEDULING_STRATEGY.HYBRID]: {
    supportsCourts: true,
    supportsTimeSlots: true,
    supportsByes: true,
    supportsRestRules: true,
    supportsVenues: true,
    supportsManualOverrides: true,
    supportsReferees: true,
    supportsRescheduling: true,
    runtimeSupported: false,
  },
  [SCHEDULING_STRATEGY.CUSTOM]: {
    supportsCourts: true,
    supportsTimeSlots: true,
    supportsByes: true,
    supportsRestRules: true,
    supportsVenues: true,
    supportsManualOverrides: true,
    supportsReferees: true,
    supportsRescheduling: true,
    runtimeSupported: false,
  },
});

/**
 * @param {string} strategy
 * @returns {StrategyCapabilities}
 */
export function getStrategyCapabilities(strategy) {
  return STRATEGY_CAPABILITIES[strategy] || STRATEGY_CAPABILITIES[SCHEDULING_STRATEGY.CUSTOM];
}

/**
 * @param {string} strategy
 */
export function isRuntimeSupportedStrategy(strategy) {
  return getStrategyCapabilities(strategy).runtimeSupported === true;
}
