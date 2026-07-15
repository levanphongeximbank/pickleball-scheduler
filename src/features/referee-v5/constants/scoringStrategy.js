/** Canonical scoring system discriminator (R1-C contract). */
export const SCORING_SYSTEM = Object.freeze({
  SIDE_OUT: "SIDE_OUT",
  RALLY: "RALLY",
});

/** Scoring variant identifiers. */
export const SCORING_VARIANT = Object.freeze({
  SIDE_OUT_DOUBLES_V1: "SIDE_OUT_DOUBLES_V1",
  SIDE_OUT_SINGLES_V1: "SIDE_OUT_SINGLES_V1",
  USAP_2026_PROVISIONAL_RALLY: "USAP_2026_PROVISIONAL_RALLY",
});

/** Registry keys for ScoringStrategy implementations. */
export const RULE_SET_ID = Object.freeze({
  SIDE_OUT_DOUBLES_V1: "side_out_doubles_v1",
  SIDE_OUT_SINGLES_V1: "side_out_singles_v1",
  RALLY_DOUBLES_LEGACY_PROTOTYPE_V1: "rally_doubles_legacy_prototype_v1",
  RALLY_SINGLES_LEGACY_V1: "rally_singles_legacy_v1",
  RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1: "rally_usap_2026_provisional_doubles_v1",
});
