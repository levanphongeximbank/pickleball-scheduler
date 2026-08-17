/**
 * Static no-fake-success guards for the trusted-server CORE-13 production path.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const HARDCODED_SCHEDULE_FIXTURE = "2026-08-17T10:00:00.000Z";
const PROFILES_TABLE_READ = /\.from\(\s*["']profiles["']\s*\)/;

function walkJs(dir, acc = []) {
  if (!statSync(dir).isDirectory()) return acc;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkJs(full, acc);
    else if (/\.(js|mjs)$/.test(name)) acc.push(full);
  }
  return acc;
}

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
  const directory = readRel(
    "src/features/competition-engine/operations/referee/assignment/server/createIdentityBackedRefereeDirectoryPort.js"
  );
  const contract08 = readRel(
    "src/features/competition-engine/integration/referee/constants.js"
  );
  const contract01 = readRel(
    "src/features/competition-engine/integration/contracts/definitions.js"
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

  if (PROFILES_TABLE_READ.test(loader)) {
    failures.push("loader queries Identity private persistence (profiles)");
  }
  if (PROFILES_TABLE_READ.test(directory)) {
    failures.push("RefereeDirectoryPort queries Identity private persistence (profiles)");
  }
  if (PROFILES_TABLE_READ.test(handler)) {
    failures.push("edge handler queries Identity private persistence (profiles)");
  }

  const serverDir = path.join(
    rootDir,
    "src/features/competition-engine/operations/referee/assignment/server"
  );
  for (const file of walkJs(serverDir)) {
    const src = readFileSync(file, "utf8");
    if (PROFILES_TABLE_READ.test(src)) {
      failures.push(
        `trusted-server CORE-13 path reads profiles directly: ${path.relative(rootDir, file)}`
      );
    }
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
  if (!/identityAccessAdapter/.test(loader)) {
    failures.push("loader does not accept Contract #01 Identity Adapter B injection");
  }
  if (!/NOT_CONFIGURED/.test(loader)) {
    failures.push("loader does not classify missing qualification/availability honestly");
  }
  if (!/IDENTITY_ACCESS_CONTRACT/.test(directory)) {
    failures.push("directory port does not bind to Contract #01");
  }
  if (/serviceClient\.from/.test(directory)) {
    failures.push("directory port still uses serviceClient table reads");
  }

  if (!/resolveSubjectIdentity/.test(directory)) {
    failures.push("directory port does not consume Contract #01 resolveSubjectIdentity");
  }
  if (/tenantId \|\| .*venueId/.test(directory) || /data\.tenantId \|\| data\.venueId/.test(directory)) {
    failures.push("directory port treats venueId as tenant proof");
  }
  if (/subjectIdentityPersistence/.test(directory) || /subjectIdentityPersistence/.test(loader) || /subjectIdentityPersistence/.test(handler)) {
    failures.push("CORE-13 assignment server imports Identity private persistence");
  }
  if (/SHARED_CONTRACT_CAPABILITY_GAP/.test(directory)) {
    failures.push("obsolete Contract #01 capability gap remains in directory port");
  }
  if (/CONTRACT_01_SUBJECT_DIRECTORY_NOT_CONFIGURED/.test(directory)) {
    failures.push("obsolete Contract #01 subject-directory gap flag remains");
  }
  if (!/createTrustedServerIdentityAccessAdapter/.test(loader) && !/createIdentityAccessBinding/.test(loader)) {
    failures.push("loader does not bind Contract #01 Identity Adapter B");
  }
  if (!/actorId/.test(directory)) {
    failures.push("directory port does not pass authenticated actorId separately from subjectId");
  }

  if (!/competition\.referee\.adapter\.v1/.test(contract08)) {
    failures.push("Contract #08 identity missing");
  }
  if (!/REFEREE_ADAPTER_REQUIRED_METHODS/.test(contract08)) {
    failures.push("Contract #08 required methods missing");
  }
  if (/resolveRefereeIdentity/.test(contract08) === false) {
    failures.push("Contract #08 must keep resolveRefereeIdentity forbidden");
  }

  if (!/competition\.identity-access\.adapter\.v1/.test(contract01)) {
    failures.push("Contract #01 identity missing");
  }
  if (!/resolveActorIdentity/.test(contract01) || !/getAuthorizationEvidence/.test(contract01)) {
    failures.push("Contract #01 required actor-context methods missing");
  }
  if (!/resolveSubjectIdentity/.test(contract01)) {
    failures.push("Contract #01 must expose resolveSubjectIdentity after PR #446");
  }

  return { ok: failures.length === 0, failures };
}
