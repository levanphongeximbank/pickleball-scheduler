/**
 * Generic initial-candidate collector with budget cap.
 * Domain modules supply concrete producers.
 */
export function collectInitialCandidates(producers = [], maxCount = 250) {
  const out = [];
  for (const producer of producers) {
    if (out.length >= maxCount) break;
    const batch = typeof producer === "function" ? producer() : producer;
    const list = Array.isArray(batch) ? batch : batch ? [batch] : [];
    for (const item of list) {
      if (out.length >= maxCount) break;
      if (item) out.push(item);
    }
  }
  return out;
}
