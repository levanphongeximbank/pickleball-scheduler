/**
 * Measure shadow comparison overhead — reporting only, no optimization.
 *
 * @param {Object} input
 * @param {() => unknown} input.runLegacy
 * @param {() => unknown} input.runShadow
 */
export function measureFormationPerformanceBaseline(input = {}) {
  const legacyStart = performance.now();
  const legacyResult = input.runLegacy();
  const legacyDurationMs = performance.now() - legacyStart;

  const shadowStart = performance.now();
  const shadowResult = input.runShadow();
  const shadowDurationMs = performance.now() - shadowStart;

  const adapterDurationMs =
    shadowResult?.bridge?.usedCanonical && shadowResult?.timing?.adapterDurationMs != null
      ? shadowResult.timing.adapterDurationMs
      : shadowDurationMs - legacyDurationMs;

  return {
    legacyDurationMs: Math.round(legacyDurationMs * 100) / 100,
    adapterDurationMs: Math.round(Math.max(0, adapterDurationMs) * 100) / 100,
    shadowDurationMs: Math.round(shadowDurationMs * 100) / 100,
    candidateCount:
      shadowResult?.bridge?.formationResult?.candidates?.length ??
      shadowResult?.comparison?.legacyPairs?.length ??
      legacyResult?.teams?.length ??
      0,
    memoryNote: "heap measurement not available in CC-05C baseline",
  };
}

/**
 * @param {Array<{ label: string, playerCount: number, report: ReturnType<typeof measureFormationPerformanceBaseline> }>} results
 */
export function summarizeFormationPerformanceReports(results = []) {
  return {
    fixtures: results,
    maxShadowOverheadMs: Math.max(...results.map((r) => r.report.shadowDurationMs), 0),
    avgLegacyMs:
      results.length > 0
        ? Math.round(
            (results.reduce((sum, r) => sum + r.report.legacyDurationMs, 0) / results.length) *
              100
          ) / 100
        : 0,
  };
}
