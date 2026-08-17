/**
 * Static no-fake-success guards for the trusted-server CORE-13 production path.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

const HARDCODED_SCHEDULE_FIXTURE = "2026-08-17T10:00:00.000Z";

/**
 * @param {string} rootDir
 * @returns {{ ok: boolean, failures: string[] }}
 */
export function assertTrustedServerNoFakeSuccess(rootDir) {
  const failures = [];
  const readRel = (rel) => readFileSync(path.join(rootDir, rel), "utf8");
  const loader = readRel(
    "src/features/competition-engine/operations/referee/assignment/server/loadAuthoritativeAssignmentEvidence.js"
  );
  const command = readRel(
    "src/features/competition-engine/operations/referee/assignment/createCompetitionRefereeAssignmentCommandService.js"
  );
  const handler = readRel(
    "src/features/competition-engine/operations/referee/assignment/server/edgeHttpHandler.js"
  );
  const contract = readRel(
    "src/features/competition-engine/integration/referee/constants.js"
  );

  if (loader.includes(HARDCODED_SCHEDULE_FIXTURE) || loader.includes("2026-08-17T11:00:00.000Z")) {
    failures.push("loader contains hardcoded match schedule timestamps");
  }
  if (command.includes(HARDCODED_SCHEDULE_FIXTURE) || command.includes("2026-08-17T11:00:00.000Z")) {
    failures.push("command service contains hardcoded match schedule timestamps");
  }
  if (handler.includes(HARDCODED_SCHEDULE_FIXTURE)) {
    failures.push("edge handler contains hardcoded match schedule timestamps");
  }

  if (/\.from\(\s*["']profiles["']\s*\)/.test(loader)) {
    failures.push("loader queries profiles directly instead of Identity directory port");
  }
  if (/createRefereeQualification/.test(loader)) {
    failures.push("loader synthesizes qualification evidence");
  }
  if (/createRefereeAvailabilityWindow/.test(loader)) {
    failures.push("loader synthesizes availability evidence");
  }
  if (/roster-qual-|canonical-qual-/.test(loader) || /roster-qual-|canonical-qual-/.test(command)) {
    failures.push("synthetic qualification ids remain in production assignment path");
  }
  if (/roster-avail-|canonical-avail-/.test(loader) || /roster-avail-|canonical-avail-/.test(command)) {
    failures.push("synthetic availability ids remain in production assignment path");
  }

  if (!/createTrustedServerRefereeAdapterB/.test(loader)) {
    failures.push("loader does not reuse Adapter B");
  }
  if (!/createIdentityBackedRefereeDirectoryPort/.test(loader)) {
    failures.push("loader does not consume Identity-backed referee directory");
  }
  if (!/NOT_CONFIGURED/.test(loader)) {
    failures.push("loader does not classify missing qualification/availability honestly");
  }

  if (!/competition\.referee\.adapter\.v1/.test(contract)) {
    failures.push("Contract #08 identity missing");
  }
  if (!/REFEREE_ADAPTER_REQUIRED_METHODS/.test(contract)) {
    failures.push("Contract #08 required methods missing");
  }
  if (/resolveRefereeIdentity/.test(contract) === false) {
    failures.push("Contract #08 must keep resolveRefereeIdentity forbidden");
  }

  return { ok: failures.length === 0, failures };
}
