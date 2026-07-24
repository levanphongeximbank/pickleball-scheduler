/**
 * GOV-08 MVP local performance budgets for E2E-07 certification.
 */

export const GOV08_MVP_LOCAL_BUDGETS = Object.freeze({
  budgetVersion: "e2e07-gov08-mvp-local-v1",
  budgetClass: "MVP_LOCAL_CERTIFICATION",
  warmUpRuns: 1,
  measuredRuns: 3,
  sizes: Object.freeze([8, 16, 32]),
  thresholdsMs: Object.freeze({
    poolCompositionMedian: Object.freeze({ 8: 500, 16: 1000, 32: 2000 }),
    fullCertificationScenarioMedian: Object.freeze({ 8: 5000, 16: 10000, 32: 20000 }),
    standingsQualificationMedian: Object.freeze({ 8: 300, 16: 600, 32: 1200 }),
    scheduleCourtMedian: Object.freeze({ 8: 400, 16: 800, 32: 1600 }),
    resultValidationMedian: Object.freeze({ 8: 200, 16: 400, 32: 800 }),
    knockoutCompositionMedian: Object.freeze({ 8: 500, 16: 1000, 32: 2000 }),
  }),
  productionSlaClaimForbidden: true,
});
