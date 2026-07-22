/**
 * CORE-11 Phase 1D — dependency graph construction, cycle detection,
 * and deterministic topological ordering (pure).
 *
 * Does not assign slots, sessions, courts, or match results.
 */

import {
  SCHEDULE_DEPENDENCY_TYPE,
  SCHEDULE_DIAGNOSTIC_SEVERITY,
  isScheduleDependencyType,
} from "./scheduleConstants.js";
import {
  SCHEDULE_DIAGNOSTIC_CODE,
  createScheduleDiagnostic,
  sortScheduleDiagnostics,
} from "./scheduleDiagnostics.js";
import {
  asciiCompare,
  isValidIdentifier,
  normalizeIdentifier,
  stableSortByKeys,
} from "./scheduleTypes.js";

/**
 * @typedef {Object} ScheduleDependencyEdge
 * @property {string} sourceMatchId
 * @property {string} dependentMatchId
 * @property {string} type
 */

/**
 * @typedef {Object} ScheduleDependencyNode
 * @property {string} matchId
 * @property {boolean} isBye
 * @property {boolean} isSchedulable
 * @property {number|null} roundNumber
 * @property {number|null} sequence
 * @property {number|null} priority
 * @property {number} inDegree
 * @property {ScheduleDependencyEdge[]} predecessors
 * @property {ScheduleDependencyEdge[]} successors
 */

/**
 * @typedef {Object} ScheduleDependencyGraph
 * @property {boolean} ok
 * @property {string[]} nodeIds
 * @property {ScheduleDependencyNode[]} nodes
 * @property {ScheduleDependencyEdge[]} edges
 * @property {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 */

/**
 * @typedef {Object} TopologicalOrderResult
 * @property {boolean} ok
 * @property {string[]} order
 * @property {string[]} fullOrder
 * @property {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 */

const MISSING_NUMERIC = Number.POSITIVE_INFINITY;

/**
 * Build a canonical dependency graph from ScheduleMatchInput records.
 *
 * @param {unknown} matches
 * @returns {ScheduleDependencyGraph}
 */
export function buildScheduleDependencyGraph(matches) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const push = (partial) => {
    diagnostics.push(createScheduleDiagnostic(partial));
  };

  if (matches === undefined || matches === null) {
    return emptyGraph(diagnostics, true);
  }
  if (!Array.isArray(matches)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
      path: "matches",
      message: "matches must be an array",
    });
    return emptyGraph(diagnostics, false);
  }

  /** @type {Map<string, { matchId: string, isBye: boolean, roundNumber: number|null, sequence: number|null, priority: number|null, path: string }>} */
  const nodeMap = new Map();
  /** @type {Map<string, string>} */
  const idOwners = new Map();

  matches.forEach((raw, index) => {
    const path = `matches[${index}]`;
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
        path,
        message: "match entry must be an object",
      });
      return;
    }
    const record = /** @type {Record<string, unknown>} */ (raw);
    const matchId = normalizeIdentifier(record.matchId);
    if (!isValidIdentifier(matchId)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
        path: `${path}.matchId`,
        message: "matchId must be a non-empty trimmed string",
      });
      return;
    }
    const owner = idOwners.get(matchId);
    if (owner != null) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_ID,
        path: `${path}.matchId`,
        message: `duplicate matchId: ${matchId}`,
        relatedMatchIds: [matchId],
        details: { leftPath: owner, rightPath: path },
      });
      return;
    }
    idOwners.set(matchId, path);
    nodeMap.set(matchId, {
      matchId,
      isBye: record.isBye === true,
      roundNumber: optionalInteger(record.roundNumber),
      sequence: optionalInteger(record.sequence),
      priority: optionalInteger(record.priority),
      path,
    });
  });

  /** @type {ScheduleDependencyEdge[]} */
  const edges = [];
  /** @type {Map<string, Set<string>>} */
  const edgeKeysByDependent = new Map();

  matches.forEach((raw, index) => {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return;
    const record = /** @type {Record<string, unknown>} */ (raw);
    const matchId = normalizeIdentifier(record.matchId);
    if (!nodeMap.has(matchId)) return;
    const path = `matches[${index}]`;
    const deps = record.dependencies;
    if (deps === undefined || deps === null) return;
    if (!Array.isArray(deps)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
        path: `${path}.dependencies`,
        message: "dependencies must be an array when provided",
        relatedMatchIds: [matchId],
      });
      return;
    }

    deps.forEach((depRaw, dIndex) => {
      const dPath = `${path}.dependencies[${dIndex}]`;
      if (depRaw == null || typeof depRaw !== "object" || Array.isArray(depRaw)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
          path: dPath,
          message: "dependency must be an object",
          relatedMatchIds: [matchId],
        });
        return;
      }
      const dep = /** @type {Record<string, unknown>} */ (depRaw);
      const sourceMatchId = normalizeIdentifier(dep.sourceMatchId);
      const type = normalizeIdentifier(dep.type);

      if (!isValidIdentifier(sourceMatchId)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
          path: `${dPath}.sourceMatchId`,
          message: "sourceMatchId must be a non-empty trimmed string",
          relatedMatchIds: [matchId],
        });
        return;
      }
      if (!type) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
          path: `${dPath}.type`,
          message: "dependency type is required",
          relatedMatchIds: [matchId, sourceMatchId],
        });
        return;
      }
      if (!isScheduleDependencyType(type)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
          path: `${dPath}.type`,
          message: `unsupported dependency type: ${type}`,
          relatedMatchIds: [matchId, sourceMatchId],
          details: {
            type,
            supported: Object.values(SCHEDULE_DEPENDENCY_TYPE),
          },
        });
        return;
      }
      if (sourceMatchId === matchId) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.SELF_MATCH_DEPENDENCY,
          path: dPath,
          message: `match cannot depend on itself: ${matchId}`,
          relatedMatchIds: [matchId],
          details: { type },
        });
        return;
      }
      if (!nodeMap.has(sourceMatchId)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.UNKNOWN_MATCH_DEPENDENCY,
          path: `${dPath}.sourceMatchId`,
          message: `dependency sourceMatchId not present in matches: ${sourceMatchId}`,
          relatedMatchIds: [matchId, sourceMatchId],
          details: { type },
        });
        return;
      }

      const tupleKey = `${sourceMatchId}\0${type}`;
      let keySet = edgeKeysByDependent.get(matchId);
      if (!keySet) {
        keySet = new Set();
        edgeKeysByDependent.set(matchId, keySet);
      }
      if (keySet.has(tupleKey)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_DEPENDENCY,
          path: dPath,
          message: `duplicate dependency edge (${sourceMatchId}, ${type})`,
          relatedMatchIds: [matchId, sourceMatchId],
          details: { sourceMatchId, type },
        });
        return;
      }
      keySet.add(tupleKey);
      edges.push({
        sourceMatchId,
        dependentMatchId: matchId,
        type,
      });
    });
  });

  const sortedEdges = stableSortByKeys(edges, (e) => [
    e.sourceMatchId,
    e.dependentMatchId,
    e.type,
  ]);

  const nodeIds = [...nodeMap.keys()].sort(asciiCompare);
  /** @type {Map<string, ScheduleDependencyEdge[]>} */
  const preds = new Map();
  /** @type {Map<string, ScheduleDependencyEdge[]>} */
  const succs = new Map();
  for (const id of nodeIds) {
    preds.set(id, []);
    succs.set(id, []);
  }
  for (const edge of sortedEdges) {
    preds.get(edge.dependentMatchId)?.push(edge);
    succs.get(edge.sourceMatchId)?.push(edge);
  }

  /** @type {ScheduleDependencyNode[]} */
  const nodes = nodeIds.map((matchId) => {
    const meta = /** @type {{ isBye: boolean, roundNumber: number|null, sequence: number|null, priority: number|null }} */ (
      nodeMap.get(matchId)
    );
    const predecessors = stableSortByKeys(preds.get(matchId) || [], (e) => [
      e.sourceMatchId,
      e.type,
    ]);
    const successors = stableSortByKeys(succs.get(matchId) || [], (e) => [
      e.dependentMatchId,
      e.type,
    ]);
    const uniquePredIds = [
      ...new Set(predecessors.map((e) => e.sourceMatchId)),
    ];
    return {
      matchId,
      isBye: meta.isBye,
      isSchedulable: !meta.isBye,
      roundNumber: meta.roundNumber,
      sequence: meta.sequence,
      priority: meta.priority,
      inDegree: uniquePredIds.length,
      predecessors,
      successors,
    };
  });

  for (const node of nodes) {
    if (node.isBye) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.BYE_NO_SCHEDULE_REQUIRED,
        severity: SCHEDULE_DIAGNOSTIC_SEVERITY.INFO,
        path: `matches[matchId=${node.matchId}].isBye`,
        message:
          "Bye match does not consume a time slot or concurrency capacity and is neither scheduled nor unscheduled",
        relatedMatchIds: [node.matchId],
      });
    }
  }

  const cycleDiagnostics = detectDependencyCycles(nodes);
  diagnostics.push(...cycleDiagnostics);

  const sorted = sortScheduleDiagnostics(diagnostics);
  const hasError = sorted.some(
    (d) => d.severity === SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR
  );

  return {
    ok: !hasError,
    nodeIds,
    nodes,
    edges: sortedEdges,
    diagnostics: sorted,
  };
}

/**
 * Deterministic Kahn topological order with complete tie-breakers.
 * Bye nodes are processed for edge satisfaction but excluded from `order`
 * (schedulable matches only). They appear in `fullOrder` for traceability.
 *
 * Tie-break (ascending unless noted):
 * 1. roundNumber (missing → +∞)
 * 2. sequence (missing → +∞)
 * 3. priority descending (higher priority earlier; missing → −∞)
 * 4. matchId ASCII
 *
 * @param {ScheduleDependencyGraph|null|undefined} graph
 * @param {unknown} [_matches] unused; ordering uses graph node metadata only
 * @returns {TopologicalOrderResult}
 */
export function topologicallyOrderScheduleMatches(graph, _matches) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  if (!graph || typeof graph !== "object" || !Array.isArray(graph.nodes)) {
    diagnostics.push(
      createScheduleDiagnostic({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
        message: "dependency graph is required",
      })
    );
    return {
      ok: false,
      order: [],
      fullOrder: [],
      diagnostics: sortScheduleDiagnostics(diagnostics),
    };
  }

  if (!graph.ok) {
    const cyclic = (graph.diagnostics || []).filter(
      (d) => d.code === SCHEDULE_DIAGNOSTIC_CODE.CYCLIC_MATCH_DEPENDENCY
    );
    return {
      ok: false,
      order: [],
      fullOrder: [],
      diagnostics: sortScheduleDiagnostics([
        ...cyclic,
        createScheduleDiagnostic({
          code: SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_ORDER_VIOLATION,
          message:
            "topological order unavailable because dependency graph is invalid",
        }),
      ]),
    };
  }

  /** @type {Map<string, ScheduleDependencyNode>} */
  const byId = new Map(graph.nodes.map((n) => [n.matchId, n]));
  /** @type {Map<string, number>} */
  const remaining = new Map();
  /** @type {Map<string, string[]>} */
  const adj = new Map();

  for (const node of graph.nodes) {
    remaining.set(node.matchId, node.inDegree);
    adj.set(
      node.matchId,
      node.successors.map((e) => e.dependentMatchId)
    );
  }

  /** @type {string[]} */
  const ready = [];
  for (const node of graph.nodes) {
    if ((remaining.get(node.matchId) || 0) === 0) {
      ready.push(node.matchId);
    }
  }
  sortReady(ready, byId);

  /** @type {string[]} */
  const fullOrder = [];
  while (ready.length > 0) {
    const next = /** @type {string} */ (ready.shift());
    fullOrder.push(next);
    const outs = adj.get(next) || [];
    const uniqueOuts = [...new Set(outs)].sort(asciiCompare);
    for (const depId of uniqueOuts) {
      const left = (remaining.get(depId) || 0) - 1;
      remaining.set(depId, left);
      if (left === 0) {
        ready.push(depId);
        sortReady(ready, byId);
      }
    }
  }

  if (fullOrder.length !== graph.nodes.length) {
    diagnostics.push(
      createScheduleDiagnostic({
        code: SCHEDULE_DIAGNOSTIC_CODE.CYCLIC_MATCH_DEPENDENCY,
        message: "topological order incomplete — residual cycle detected",
        relatedMatchIds: graph.nodeIds.filter(
          (id) => (remaining.get(id) || 0) > 0
        ),
      })
    );
    return {
      ok: false,
      order: [],
      fullOrder: [],
      diagnostics: sortScheduleDiagnostics(diagnostics),
    };
  }

  const order = fullOrder.filter((id) => byId.get(id)?.isSchedulable === true);
  return {
    ok: true,
    order,
    fullOrder,
    diagnostics: sortScheduleDiagnostics(diagnostics),
  };
}

/**
 * DFS cycle detection with ASCII-stable node visitation and canonical cycle paths.
 *
 * @param {ScheduleDependencyNode[]} nodes
 * @returns {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]}
 */
export function detectDependencyCycles(nodes) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const out = [];
  /** @type {Map<string, ScheduleDependencyNode>} */
  const byId = new Map(nodes.map((n) => [n.matchId, n]));
  const ids = [...byId.keys()].sort(asciiCompare);

  /** @type {Map<string, number>} 0=white 1=gray 2=black */
  const color = new Map(ids.map((id) => [id, 0]));
  /** @type {string[]} */
  const stack = [];
  /** @type {Set<string>} */
  const reported = new Set();

  /**
   * @param {string} id
   */
  function dfs(id) {
    color.set(id, 1);
    stack.push(id);
    const node = byId.get(id);
    const outs = stableSortByKeys(node?.successors || [], (e) => [
      e.dependentMatchId,
      e.type,
    ]);
    for (const edge of outs) {
      const next = edge.dependentMatchId;
      const c = color.get(next) || 0;
      if (c === 1) {
        const idx = stack.indexOf(next);
        const cycle =
          idx >= 0 ? stack.slice(idx).concat(next) : [id, next, id];
        const canonical = canonicalizeCycle(cycle);
        const key = canonical.join("\0");
        if (!reported.has(key)) {
          reported.add(key);
          out.push(
            createScheduleDiagnostic({
              code: SCHEDULE_DIAGNOSTIC_CODE.CYCLIC_MATCH_DEPENDENCY,
              path: "dependencies",
              message: `cyclic match dependency: ${canonical.join(" -> ")}`,
              relatedMatchIds: canonical.slice(0, -1),
              details: { cycle: canonical },
            })
          );
        }
      } else if (c === 0) {
        dfs(next);
      }
    }
    stack.pop();
    color.set(id, 2);
  }

  for (const id of ids) {
    if ((color.get(id) || 0) === 0) {
      dfs(id);
    }
  }

  return sortScheduleDiagnostics(out);
}

/**
 * @param {string[]} cycle path ending with repeat of start
 * @returns {string[]}
 */
function canonicalizeCycle(cycle) {
  if (!cycle.length) return cycle;
  const body = cycle[cycle.length - 1] === cycle[0] ? cycle.slice(0, -1) : [...cycle];
  if (!body.length) return cycle;
  let minIdx = 0;
  for (let i = 1; i < body.length; i += 1) {
    if (asciiCompare(body[i], body[minIdx]) < 0) minIdx = i;
  }
  const rotated = body.slice(minIdx).concat(body.slice(0, minIdx));
  return rotated.concat(rotated[0]);
}

/**
 * @param {string[]} ready
 * @param {Map<string, ScheduleDependencyNode>} byId
 */
function sortReady(ready, byId) {
  ready.sort((a, b) => compareTopoCandidates(byId.get(a), byId.get(b)));
}

/**
 * @param {ScheduleDependencyNode|undefined} a
 * @param {ScheduleDependencyNode|undefined} b
 * @returns {number}
 */
function compareTopoCandidates(a, b) {
  const aRound = a?.roundNumber == null ? MISSING_NUMERIC : a.roundNumber;
  const bRound = b?.roundNumber == null ? MISSING_NUMERIC : b.roundNumber;
  if (aRound !== bRound) return aRound < bRound ? -1 : 1;

  const aSeq = a?.sequence == null ? MISSING_NUMERIC : a.sequence;
  const bSeq = b?.sequence == null ? MISSING_NUMERIC : b.sequence;
  if (aSeq !== bSeq) return aSeq < bSeq ? -1 : 1;

  // Higher priority earlier (descending). Missing → −∞ (last among priority ties).
  const aPri = a?.priority == null ? Number.NEGATIVE_INFINITY : a.priority;
  const bPri = b?.priority == null ? Number.NEGATIVE_INFINITY : b.priority;
  if (aPri !== bPri) return aPri > bPri ? -1 : 1;

  return asciiCompare(a?.matchId, b?.matchId);
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function optionalInteger(value) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value)) return null;
  return /** @type {number} */ (value);
}

/**
 * @param {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 * @param {boolean} ok
 * @returns {ScheduleDependencyGraph}
 */
function emptyGraph(diagnostics, ok) {
  return {
    ok,
    nodeIds: [],
    nodes: [],
    edges: [],
    diagnostics: sortScheduleDiagnostics(diagnostics),
  };
}
