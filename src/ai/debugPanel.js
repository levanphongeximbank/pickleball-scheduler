/*
==========================================================
AI Debug Panel Helpers
Exposes a compact structured summary for recent runs.
==========================================================
*/

export function formatDebugTrace(trace = []) {
  if (!Array.isArray(trace)) {
    return [];
  }

  return trace.map((entry) => {
    const details = entry?.details || {};
    const detailText = Object.entries(details)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ");

    return detailText ? `${entry.step} (${detailText})` : entry.step;
  });
}

export function buildDebugSummary(result = {}) {
  const trace = Array.isArray(result.debugTrace) ? result.debugTrace : [];

  return {
    totalCourts: result.courts?.length || 0,
    waitingCount: result.waiting?.length || 0,
    aiScore: result.aiScore?.total || 0,
    bestCandidateScore: result.bestCandidateScore || 0,
    candidateCount: result.candidates?.length || 0,
    explanationCount: result.explanation?.length || 0,
    persisted: result.persisted === true,
    traceSteps: trace.map((entry) => entry.step),
    traceLines: formatDebugTrace(trace),
  };
}
