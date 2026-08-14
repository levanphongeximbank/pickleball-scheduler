/**
 * Semantic club-blob compare for dirty reconciliation.
 * Ignores volatile timestamps. Does not write cloud.
 */

const VOLATILE_KEYS = new Set(["updatedAt", "syncedAt", "exportedAt", "_cloudMirrorAt"]);

const SEMANTIC_PATHS = [
  "schemaVersion",
  "clubId",
  "players",
  "courts",
  "bookings",
  "customers",
  "recurringSeries",
  "courtManagement",
  "seasons",
  "leagues",
  "rounds",
  "sessions",
  "tournaments",
  "founderPairingConstraints",
  "seasonStandings",
  "skillLevel",
  "skillLevelProposals",
  "skillLevelChangeRequests",
  "ai",
  "active",
  "director",
];

function stripVolatile(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stripVolatile(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const next = {};
  Object.keys(value)
    .sort()
    .forEach((key) => {
      if (VOLATILE_KEYS.has(key)) {
        return;
      }
      next[key] = stripVolatile(value[key]);
    });
  return next;
}

export function diffClubBlobSemantic(localBlob, remoteBlob) {
  const local = localBlob && typeof localBlob === "object" ? localBlob : {};
  const remote = remoteBlob && typeof remoteBlob === "object" ? remoteBlob : {};
  const paths = [];
  SEMANTIC_PATHS.forEach((path) => {
    const left = JSON.stringify(stripVolatile(local[path]));
    const right = JSON.stringify(stripVolatile(remote[path]));
    if (left !== right) {
      paths.push(path);
    }
  });
  return paths;
}
