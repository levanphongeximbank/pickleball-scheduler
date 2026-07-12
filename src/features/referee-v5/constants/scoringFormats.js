export const SCORING_FORMAT = Object.freeze({
  SIDE_OUT: "side_out",
  RALLY: "rally",
});

/** Rally scoring variants — MLP is not supported in V5-C */
export const RALLY_VARIANT = Object.freeze({
  BASIC: "basic",
  MLP: "mlp",
});


export const DEFAULT_SIDE_OUT_CONFIG = Object.freeze({
  pointsToWin: 11,
  winBy: 2,
  maximumScore: null,
  sideOutInitialServerSide: "RIGHT_SERVICE_COURT",
});

export const DEFAULT_RALLY_CONFIG = Object.freeze({
  pointsToWin: 21,
  winBy: 2,
  maximumScore: null,
  sideSwitchAt: 11,
  /** OWNER DECISION REQUIRED: full rally serve rotation order */
  rallyServeRotation: "winning_team_serves",
});
