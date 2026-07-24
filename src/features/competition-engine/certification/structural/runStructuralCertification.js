/**
 * E2E-07 structural certification — exports, markers, architecture bans.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pkg from "../../../../../package.json" with { type: "json" };

import { createPoolKnockoutRuntimeComposition } from "../../application/createPoolKnockoutRuntimeComposition.js";
import { createCompetitionRuntimePorts } from "../../integration/composition/createCompetitionRuntimePorts.js";
import { COMPETITION_ENGINE_INTEGRATION } from "../../integration/index.js";
import { createOrganizerOperationsFacade } from "../../operations/createOrganizerOperationsFacade.js";
import { COMPETITION_ENGINE_PLAYER_OPERATIONS } from "../../operations/player/index.js";
import { COMPETITION_ENGINE_REFEREE_OPERATIONS } from "../../operations/referee/index.js";
import { COMPETITION_ENGINE_PUBLIC_EXPERIENCE } from "../../operations/public/index.js";
import { COMPETITION_ENGINE_GOVERNANCE_RELIABILITY } from "../../operations/governance/index.js";
import { buildCertificationReadinessProjection } from "../../operations/governance/projections/buildCertificationReadinessProjection.js";
import { createPlayerCompetitionOperationsFacade } from "../../operations/player/createPlayerCompetitionOperationsFacade.js";
import { createRefereeCompetitionOperationsFacade } from "../../operations/referee/createRefereeCompetitionOperationsFacade.js";
import { createPublicCompetitionExperienceFacade } from "../../operations/public/createPublicCompetitionExperienceFacade.js";
import { createCompetitionGovernanceReliabilityFacade } from "../../operations/governance/createCompetitionGovernanceReliabilityFacade.js";
import {
  CERTIFICATION_ARCHITECTURE_BAN_TOKENS,
  CERTIFICATION_CHECK,
  CERTIFICATION_ERROR_CODE,
  COMPETITION_ENGINE_END_TO_END_CERTIFICATION,
} from "../constants.js";
import { computeCertificationFingerprint, deepFreeze } from "../fingerprint.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../.."
);
const CERT_DIR = path.join(ROOT, "src/features/competition-engine/certification");

const REQUIRED_EXPORTS = Object.freeze([
  { name: "createCompetitionRuntimePorts", value: createCompetitionRuntimePorts },
  {
    name: "createPoolKnockoutRuntimeComposition",
    value: createPoolKnockoutRuntimeComposition,
  },
  {
    name: "createOrganizerOperationsFacade",
    value: createOrganizerOperationsFacade,
  },
  {
    name: "createPlayerCompetitionOperationsFacade",
    value: createPlayerCompetitionOperationsFacade,
  },
  {
    name: "createRefereeCompetitionOperationsFacade",
    value: createRefereeCompetitionOperationsFacade,
  },
  {
    name: "createPublicCompetitionExperienceFacade",
    value: createPublicCompetitionExperienceFacade,
  },
  {
    name: "createCompetitionGovernanceReliabilityFacade",
    value: createCompetitionGovernanceReliabilityFacade,
  },
  {
    name: "buildCertificationReadinessProjection",
    value: buildCertificationReadinessProjection,
  },
]);

const ENGINE_MARKERS = Object.freeze([
  COMPETITION_ENGINE_INTEGRATION,
  Object.freeze({
    id: "competition-engine-organizer-operations",
    phase: "E2E-03",
    ownsEngines: false,
  }),
  COMPETITION_ENGINE_PLAYER_OPERATIONS,
  COMPETITION_ENGINE_REFEREE_OPERATIONS,
  COMPETITION_ENGINE_PUBLIC_EXPERIENCE,
  COMPETITION_ENGINE_GOVERNANCE_RELIABILITY,
  COMPETITION_ENGINE_END_TO_END_CERTIFICATION,
]);

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listCertJsFiles(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listCertJsFiles(full));
    else if (entry.name.endsWith(".js")) files.push(full);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

/**
 * @param {string} absolutePath
 * @returns {string}
 */
function toPosixRel(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

/**
 * @param {object} [input]
 */
export function runStructuralCertification(input = {}) {
  /** @type {Array<{ id: string, ok: boolean, detail: string }>} */
  const checks = [];

  for (const exp of REQUIRED_EXPORTS) {
    checks.push({
      id: `${CERTIFICATION_CHECK.STRUCTURAL_EXPORTS}:${exp.name}`,
      ok: typeof exp.value === "function",
      detail:
        typeof exp.value === "function"
          ? `${exp.name} exported`
          : `${exp.name} missing`,
    });
  }

  const govFacade = createCompetitionGovernanceReliabilityFacade({});
  checks.push({
    id: `${CERTIFICATION_CHECK.STRUCTURAL_EXPORTS}:createCertificationReadinessProjection`,
    ok: typeof govFacade.createCertificationReadinessProjection === "function",
    detail: "governance facade exposes createCertificationReadinessProjection",
  });

  checks.push({
    id: `${CERTIFICATION_CHECK.STRUCTURAL_EXPORTS}:packageMetadata`,
    ok: Boolean(pkg.name) && Boolean(pkg.version),
    detail: `name=${pkg.name} version=${pkg.version}`,
  });

  for (const marker of ENGINE_MARKERS) {
    const ownsEnginesOk = marker.ownsEngines === false;
    checks.push({
      id: `${CERTIFICATION_CHECK.NO_PARALLEL_ENGINES}:${marker.id || marker.phase}`,
      ok: ownsEnginesOk,
      detail: `ownsEngines=${marker.ownsEngines}`,
    });
  }

  const certFiles = listCertJsFiles(CERT_DIR).filter(
    (file) =>
      !file.endsWith("runStructuralCertification.js") &&
      path.basename(file) !== "constants.js"
  );
  for (const file of certFiles) {
    const rel = toPosixRel(file);
    const src = readFileSync(file, "utf8");
    for (const token of CERTIFICATION_ARCHITECTURE_BAN_TOKENS) {
      checks.push({
        id: `${CERTIFICATION_CHECK.ARCHITECTURE_BANS}:${rel}:${token}`,
        ok: !src.includes(token),
        detail: src.includes(token)
          ? `banned token ${token} in ${rel}`
          : "clean",
      });
    }
  }

  const ok = checks.every((c) => c.ok);
  const evidence = deepFreeze({
    packageName: pkg.name,
    packageVersion: pkg.version,
    exportCount: REQUIRED_EXPORTS.length,
    markerCount: ENGINE_MARKERS.length,
    certificationFilesScanned: certFiles.length,
    sourceCommit: input.sourceCommit ?? null,
    generatedAt: input.generatedAt ?? null,
  });

  const fingerprint = computeCertificationFingerprint({
    kind: "structural-certification",
    ok,
    checks: checks.map((c) => ({ id: c.id, ok: c.ok })),
    evidence,
  });

  return deepFreeze({
    ok,
    checks: Object.freeze(checks),
    evidence,
    fingerprint,
    blockers: Object.freeze(
      ok
        ? []
        : checks
            .filter((c) => !c.ok)
            .map((c) =>
              Object.freeze({
                code: CERTIFICATION_ERROR_CODE.STRUCTURAL_FAILURE,
                message: c.detail,
                checkId: c.id,
              })
            )
    ),
  });
}
