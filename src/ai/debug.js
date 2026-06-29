/*
==========================================================
AI Debug Helpers
Collects lightweight trace information for each run.
==========================================================
*/

export function createDebugTrace(step, details = {}) {
  return {
    step,
    details,
    timestamp: new Date().toISOString(),
  };
}

export function appendDebugTrace(trace, entry) {
  return [...trace, entry];
}
