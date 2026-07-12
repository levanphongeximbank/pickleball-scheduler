export const COURT_END = Object.freeze({
  NEAR_END: "NEAR_END",
  FAR_END: "FAR_END",
});

export const OPPOSITE_COURT_END = Object.freeze({
  [COURT_END.NEAR_END]: COURT_END.FAR_END,
  [COURT_END.FAR_END]: COURT_END.NEAR_END,
});

export function flipCourtEnd(courtEnd) {
  return OPPOSITE_COURT_END[courtEnd] || courtEnd;
}
