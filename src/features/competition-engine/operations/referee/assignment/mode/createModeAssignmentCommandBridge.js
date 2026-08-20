/**
 * Mode assignment bridge — modes shape context only; CORE-13 owns decisions.
 * Legacy blob writers are neutralized as non-authoritative projection helpers.
 */

import {
  ASSIGNMENT_COMPETITION_MODE,
  ASSIGNMENT_COMMAND_ERROR_CODE,
} from "../constants.js";
import { failAssignmentCommand } from "../errors.js";
import { createCompetitionRefereeAssignmentCommandService } from "../createCompetitionRefereeAssignmentCommandService.js";

export const LEGACY_ASSIGNMENT_WRITER_STATUS = Object.freeze({
  NEUTRALIZED: "NEUTRALIZED",
  AUTHORITY: "NONE",
  PRODUCT_WRITERS: 0,
});

/**
 * @param {{
 *   commandService: ReturnType<typeof createCompetitionRefereeAssignmentCommandService>,
 *   competitionMode: string,
 *   projectAssignment?: (result: object, command: object) => unknown,
 * }} options
 */
export function createModeAssignmentCommandBridge(options = {}) {
  const commandService = options.commandService;
  if (!commandService) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.PERSISTENCE_REQUIRED,
      "Mode bridge requires shared CORE-13 assignment command service",
      {}
    );
  }
  const competitionMode = String(
    options.competitionMode || ASSIGNMENT_COMPETITION_MODE.INTERNAL
  ).toUpperCase();

  async function run(method, command = {}) {
    if (
      competitionMode === ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY &&
      command.refereeFeatureEnabled !== true
    ) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.DAILY_PLAY_NOT_APPLICABLE,
        "Daily Play without referee feature: CORE-13 assignment not applicable",
        { policy: "NOT_APPLICABLE_FOR_INSTANCE" }
      );
    }
    const payload = {
      ...command,
      competitionMode,
      refereeFeatureEnabled:
        competitionMode === ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY
          ? command.refereeFeatureEnabled === true
          : true,
    };
    const result = await commandService[method](payload);
    if (typeof options.projectAssignment === "function") {
      const projection = await options.projectAssignment(result, payload);
      return Object.freeze({ ...result, projection });
    }
    return result;
  }

  return Object.freeze({
    competitionMode,
    legacyWriterStatus: LEGACY_ASSIGNMENT_WRITER_STATUS,
    core13Bound: true,
    assignReferee: (command) => run("assignReferee", command),
    replaceReferee: (command) => run("replaceReferee", command),
    unassignReferee: (command) => run("unassignReferee", command),
    getActiveAssignment: (scope) => commandService.getActiveAssignment(scope),
    getMatchAssignmentVersion: (scope) =>
      commandService.getMatchAssignmentVersion(scope),
  });
}

/**
 * Factory helper for tests / composition.
 */
export function createBoundModeAssignmentRuntime({
  persistence,
  competitionMode,
  production = false,
  projectAssignment,
  authorize,
  authorizeEmergency,
} = {}) {
  const commandService = createCompetitionRefereeAssignmentCommandService({
    persistence,
    production,
    authorize,
    authorizeEmergency,
  });
  return createModeAssignmentCommandBridge({
    commandService,
    competitionMode,
    projectAssignment,
  });
}
