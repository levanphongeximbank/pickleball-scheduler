/**
 * CORE-16 — scoring capability identity / schema versions.
 */

export const CORE16_ENGINE_ID = "competition-core.scoring";
export const CORE16_ENGINE_VERSION = "1.0.0";

export const SCORING_FORMAT_SCHEMA_V1 = "competition-core.scoring.format.v1";
export const SCORING_STATE_SCHEMA_V1 = "competition-core.scoring.state.v1";
export const SCORING_EVENT_SCHEMA_V1 = "competition-core.scoring.event.v1";
export const SCORING_PROJECTION_SCHEMA_V1 =
  "competition-core.scoring.projection.v1";
export const SCORING_COMMAND_SCHEMA_V1 = "competition-core.scoring.command.v1";

export const CORE16_IDENTITY = Object.freeze({
  engineId: CORE16_ENGINE_ID,
  engineVersion: CORE16_ENGINE_VERSION,
  formatSchema: SCORING_FORMAT_SCHEMA_V1,
  stateSchema: SCORING_STATE_SCHEMA_V1,
  eventSchema: SCORING_EVENT_SCHEMA_V1,
  projectionSchema: SCORING_PROJECTION_SCHEMA_V1,
  commandSchema: SCORING_COMMAND_SCHEMA_V1,
});
