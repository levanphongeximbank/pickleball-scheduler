import { getScopedStorageKey } from "../../../data/club.js";

const RUNS_KEY_PREFIX = "pickleball-tournament-engine-runs";

function storageKey(clubId, tournamentId) {
  return getScopedStorageKey(`${RUNS_KEY_PREFIX}::${tournamentId}`, clubId);
}

function readRuns(clubId, tournamentId) {
  try {
    const raw = localStorage.getItem(storageKey(clubId, tournamentId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeRuns(clubId, tournamentId, runs) {
  localStorage.setItem(storageKey(clubId, tournamentId), JSON.stringify(runs.slice(0, 100)));
}

export function appendEngineRun(clubId, tournamentId, run) {
  const runs = readRuns(clubId, tournamentId);
  const entry = {
    id: `run-${Date.now()}-${runs.length}`,
    tournamentId,
    engineType: run.engineType,
    inputSummary: run.inputSummary || {},
    output: run.output || null,
    warnings: run.warnings || [],
    errors: run.errors || [],
    explain: run.explain || [],
    createdBy: run.createdBy,
    createdAt: new Date().toISOString(),
  };
  runs.unshift(entry);
  writeRuns(clubId, tournamentId, runs);
  return entry;
}

export function listEngineRuns(clubId, tournamentId) {
  return readRuns(clubId, tournamentId);
}

export function clearEngineRuns(clubId, tournamentId) {
  writeRuns(clubId, tournamentId, []);
}
