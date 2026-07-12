import { V5_VERSION_BUNDLE } from "../constants/versions.js";

/** Active frozen contract for server persistence — no client input. */
export function getActiveVersionContract() {
  return {
    assessmentVersion: V5_VERSION_BUNDLE.assessmentVersion,
    questionBankVersion: V5_VERSION_BUNDLE.questionBankVersion,
    scoringEngineVersion: V5_VERSION_BUNDLE.scoringEngineVersion,
    calibrationVersion: V5_VERSION_BUNDLE.calibrationVersion,
    gateVersion: V5_VERSION_BUNDLE.gateVersion,
    reliabilityVersion: V5_VERSION_BUNDLE.reliabilityVersion,
    glossaryVersion: V5_VERSION_BUNDLE.glossaryVersion,
    systemVersion: V5_VERSION_BUNDLE.systemVersion,
  };
}
