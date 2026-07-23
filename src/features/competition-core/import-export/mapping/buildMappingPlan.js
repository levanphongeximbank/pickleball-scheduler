/**
 * CORE-22 reference / ID mapping plan + conflict detection.
 * Pure — does not write mappings to state.
 */

import {
  CONFLICT_TYPE,
  ID_MAPPING_ACTION,
  ID_MAPPING_STATUS,
} from "../constants.js";
import {
  createIdMappingEntry,
  createReferenceMappingEntry,
  createIdMappingPlan,
} from "../contracts/reference-mapping.js";
import {
  createConflictReportEntry,
  createConflictReport,
} from "../contracts/conflict-report.js";
import {
  compareStableString,
  isPlainObject,
  isNonEmptyString,
} from "../utils/helpers.js";
import { sha256Canonical } from "../integrity/index.js";
import { createDefaultAdapterRegistry } from "../adapters/index.js";

/**
 * @param {object} parts
 * @returns {string}
 */
function conflictIdFor(parts) {
  return `cft:${sha256Canonical(parts).slice(0, 16)}`;
}

/**
 * Build deterministic mapping plan.
 *
 * @param {object} input
 * @param {object} input.package
 * @param {string} input.packageFingerprint
 * @param {string} input.targetRevisionFingerprint
 * @param {string[]} [input.selectedModules]
 * @param {object} [input.mappingPolicy]
 * @param {object} [input.adapterRegistry]
 * @param {object} [input.targetIndex] — map of `namespace:id` → existing entity
 * @param {object} [input.immutableTargets] — map of `namespace:id` → true
 * @returns {Readonly<object>}
 */
export function buildMappingPlan(input = {}) {
  const pkg = input.package;
  const registry = input.adapterRegistry ?? createDefaultAdapterRegistry();
  const selected = Array.isArray(input.selectedModules)
    ? [...input.selectedModules].sort(compareStableString)
    : [...(pkg?.manifest?.includedModules ?? [])].sort(compareStableString);

  const mappingPolicy = isPlainObject(input.mappingPolicy)
    ? input.mappingPolicy
    : { defaultAction: ID_MAPPING_ACTION.PRESERVE };
  const targetIndex = isPlainObject(input.targetIndex) ? input.targetIndex : {};
  const immutableTargets = isPlainObject(input.immutableTargets)
    ? input.immutableTargets
    : {};

  /** @type {object[]} */
  const idEntries = [];
  /** @type {object[]} */
  const refEntries = [];
  /** @type {object[]} */
  const conflicts = [];

  /** @type {Map<string, object>} */
  const sourceSeen = new Map();
  /** @type {Map<string, object>} */
  const targetSeen = new Map();
  /** @type {Map<string, string[]>} */
  const parentEdges = new Map();

  for (const mod of selected) {
    const adapter = registry.resolve(mod);
    const payload = pkg?.modules?.[mod];
    /** @type {object[]} */
    let hints = [];
    if (adapter && typeof adapter.importMappingHints === "function") {
      hints = adapter.importMappingHints(payload) ?? [];
    } else if (adapter && typeof adapter.extractReferences === "function") {
      hints = (adapter.extractReferences(payload) ?? []).map((r) => ({
        ...r,
        action: mappingPolicy.defaultAction ?? ID_MAPPING_ACTION.PRESERVE,
      }));
    }

    // Generic entities array fallback.
    if (hints.length === 0 && isPlainObject(payload) && Array.isArray(payload.entities)) {
      for (const e of payload.entities) {
        if (isPlainObject(e) && typeof e.id === "string") {
          hints.push({
            sourceNamespace: mod,
            sourceReference: e.id,
            sourceId: e.id,
            entityType: e.entityType ?? mod,
            parentId: e.parentId ?? null,
            // Leave action unset — mappingPolicy.defaultAction applies.
          });
        }
      }
    }

    // Propagate parentId from entities when hints came from extractReferences.
    if (isPlainObject(payload) && Array.isArray(payload.entities)) {
      /** @type {Map<string, unknown>} */
      const byId = new Map();
      for (const e of payload.entities) {
        if (isPlainObject(e) && typeof e.id === "string") byId.set(e.id, e);
      }
      for (const hint of hints) {
        if (hint.parentId != null) continue;
        const id = hint.sourceId ?? hint.sourceReference;
        const ent = byId.get(String(id));
        if (isPlainObject(ent) && ent.parentId != null) {
          hint.parentId = ent.parentId;
        }
        if (!hint.sourceId && id) hint.sourceId = String(id);
      }
    }

    for (const hint of hints) {
      const sourceNamespace = String(
        hint.sourceNamespace ?? mod
      ).trim();
      const sourceId = String(
        hint.sourceId ?? hint.sourceReference ?? ""
      ).trim();
      const entityType = String(hint.entityType ?? mod).trim();
      if (!sourceId) continue;

      const sourceKey = `${sourceNamespace}:${entityType}:${sourceId}`;
      if (sourceSeen.has(sourceKey)) {
        conflicts.push(
          createConflictReportEntry({
            conflictId: conflictIdFor({
              type: CONFLICT_TYPE.DUPLICATE_ENTITY,
              sourceKey,
            }),
            conflictType: CONFLICT_TYPE.DUPLICATE_ENTITY,
            entityType,
            sourceReference: sourceKey,
            explanation: "Duplicate source ID in mapping plan",
          })
        );
        continue;
      }

      let action = String(
        hint.action ?? mappingPolicy.defaultAction ?? ID_MAPPING_ACTION.PRESERVE
      ).trim();

      // Policy overrides by entity.
      if (
        isPlainObject(mappingPolicy.actions) &&
        mappingPolicy.actions[sourceKey]
      ) {
        action = String(mappingPolicy.actions[sourceKey]).trim();
      }

      let targetNamespace = hint.targetNamespace ?? sourceNamespace;
      let targetId = hint.targetId ?? null;
      let status = ID_MAPPING_STATUS.PLANNED;
      /** @type {string[]} */
      const conflictIds = [];
      let explanation = hint.explanation ?? null;

      if (action === ID_MAPPING_ACTION.PRESERVE) {
        targetId = targetId ?? sourceId;
        const existingKey = `${targetNamespace}:${targetId}`;
        if (targetIndex[existingKey]) {
          // Existing target with preserve → conflict unless reuse intended.
          const cId = conflictIdFor({
            type: CONFLICT_TYPE.EXISTING_TARGET,
            existingKey,
          });
          conflicts.push(
            createConflictReportEntry({
              conflictId: cId,
              conflictType: CONFLICT_TYPE.EXISTING_TARGET,
              entityType,
              sourceReference: sourceKey,
              targetReference: existingKey,
              explanation: "Target already exists for PRESERVE mapping",
            })
          );
          conflictIds.push(cId);
          status = ID_MAPPING_STATUS.CONFLICTED;
        }
        if (immutableTargets[existingKey]) {
          const cId = conflictIdFor({
            type: CONFLICT_TYPE.IMMUTABLE_FIELD_CONFLICT,
            existingKey,
          });
          conflicts.push(
            createConflictReportEntry({
              conflictId: cId,
              conflictType: CONFLICT_TYPE.IMMUTABLE_FIELD_CONFLICT,
              entityType,
              sourceReference: sourceKey,
              targetReference: existingKey,
              explanation: "Immutable target conflict",
            })
          );
          conflictIds.push(cId);
          status = ID_MAPPING_STATUS.CONFLICTED;
          action = ID_MAPPING_ACTION.REJECTED;
        }
      } else if (action === ID_MAPPING_ACTION.REMAP) {
        targetId =
          targetId ??
          (isNonEmptyString(hint.remapTo) ? String(hint.remapTo) : null);
        if (!targetId) {
          action = ID_MAPPING_ACTION.UNRESOLVED;
          status = ID_MAPPING_STATUS.BLOCKED;
          explanation = "REMAP missing targetId";
        }
      } else if (action === ID_MAPPING_ACTION.REUSE_EXISTING) {
        const reuseKey = hint.reuseKey ?? `${targetNamespace}:${sourceId}`;
        if (!targetIndex[reuseKey]) {
          action = ID_MAPPING_ACTION.UNRESOLVED;
          status = ID_MAPPING_STATUS.BLOCKED;
          explanation = "REUSE_EXISTING target not found";
          const cId = conflictIdFor({
            type: CONFLICT_TYPE.UNRESOLVED_REFERENCE,
            reuseKey,
          });
          conflicts.push(
            createConflictReportEntry({
              conflictId: cId,
              conflictType: CONFLICT_TYPE.UNRESOLVED_REFERENCE,
              entityType,
              sourceReference: sourceKey,
              targetReference: reuseKey,
              explanation: "Reuse target missing",
            })
          );
          conflictIds.push(cId);
        } else {
          targetId = String(reuseKey.split(":").slice(1).join(":") || sourceId);
        }
      } else if (action === ID_MAPPING_ACTION.CREATE_NEW) {
        targetNamespace = targetNamespace ?? sourceNamespace;
        targetId = null;
      } else if (action === ID_MAPPING_ACTION.EXTERNAL_REFERENCE) {
        refEntries.push(
          createReferenceMappingEntry({
            sourceNamespace,
            sourceReference: sourceId,
            action: ID_MAPPING_ACTION.EXTERNAL_REFERENCE,
            status: ID_MAPPING_STATUS.PLANNED,
          })
        );
        sourceSeen.set(sourceKey, hint);
        continue;
      } else if (action === ID_MAPPING_ACTION.UNRESOLVED) {
        status = ID_MAPPING_STATUS.BLOCKED;
        const cId = conflictIdFor({
          type: CONFLICT_TYPE.UNRESOLVED_REFERENCE,
          sourceKey,
        });
        conflicts.push(
          createConflictReportEntry({
            conflictId: cId,
            conflictType: CONFLICT_TYPE.UNRESOLVED_REFERENCE,
            entityType,
            sourceReference: sourceKey,
            explanation: explanation ?? "Unresolved reference",
          })
        );
        conflictIds.push(cId);
      } else if (action === ID_MAPPING_ACTION.REJECTED) {
        status = ID_MAPPING_STATUS.BLOCKED;
      }

      // Ambiguous: multiple targets declared.
      if (Array.isArray(hint.candidateTargets) && hint.candidateTargets.length > 1) {
        const cId = conflictIdFor({
          type: CONFLICT_TYPE.AMBIGUOUS_REFERENCE,
          sourceKey,
        });
        conflicts.push(
          createConflictReportEntry({
            conflictId: cId,
            conflictType: CONFLICT_TYPE.AMBIGUOUS_REFERENCE,
            entityType,
            sourceReference: sourceKey,
            explanation: "Ambiguous reference targets",
          })
        );
        conflictIds.push(cId);
        status = ID_MAPPING_STATUS.CONFLICTED;
        action = ID_MAPPING_ACTION.UNRESOLVED;
      }

      if (targetId != null) {
        const tKey = `${targetNamespace}:${targetId}`;
        if (targetSeen.has(tKey) && action !== ID_MAPPING_ACTION.REUSE_EXISTING) {
          const cId = conflictIdFor({
            type: CONFLICT_TYPE.DUPLICATE_ENTITY,
            tKey,
          });
          conflicts.push(
            createConflictReportEntry({
              conflictId: cId,
              conflictType: CONFLICT_TYPE.DUPLICATE_ENTITY,
              entityType,
              targetReference: tKey,
              explanation: "Duplicate target ID in mapping plan",
            })
          );
          conflictIds.push(cId);
          status = ID_MAPPING_STATUS.CONFLICTED;
        } else {
          targetSeen.set(tKey, { sourceKey });
        }
      }

      if (hint.parentId) {
        const parentKey = `${sourceNamespace}:${entityType}:${hint.parentId}`;
        const list = parentEdges.get(sourceKey) ?? [];
        list.push(parentKey);
        parentEdges.set(sourceKey, list);
      }

      const entry = createIdMappingEntry({
        sourceNamespace,
        sourceId,
        entityType,
        targetNamespace:
          action === ID_MAPPING_ACTION.UNRESOLVED ||
          action === ID_MAPPING_ACTION.REJECTED ||
          action === ID_MAPPING_ACTION.EXTERNAL_REFERENCE
            ? targetNamespace
            : targetNamespace,
        targetId,
        action,
        status,
        conflictIds,
        explanation,
      });
      idEntries.push(entry);
      sourceSeen.set(sourceKey, entry);
    }
  }

  // Unresolved parents.
  for (const [childKey, parents] of parentEdges.entries()) {
    for (const parentKey of parents) {
      if (!sourceSeen.has(parentKey) && !targetIndex[parentKey]) {
        // Also allow namespace:id targetIndex keys without entityType.
        const shortKey = parentKey.split(":").filter(Boolean);
        const loose =
          shortKey.length >= 2
            ? `${shortKey[0]}:${shortKey[shortKey.length - 1]}`
            : parentKey;
        if (!targetIndex[loose]) {
          const cId = conflictIdFor({
            type: CONFLICT_TYPE.MISSING_DEPENDENCY,
            childKey,
            parentKey,
          });
          conflicts.push(
            createConflictReportEntry({
              conflictId: cId,
              conflictType: CONFLICT_TYPE.MISSING_DEPENDENCY,
              sourceReference: childKey,
              targetReference: parentKey,
              explanation: "Unresolved parent reference",
            })
          );
        }
      }
    }
  }

  // Cyclic references (simple DFS on parentEdges using source keys).
  const cycleConflicts = detectCycles(parentEdges);
  for (const cycle of cycleConflicts) {
    conflicts.push(
      createConflictReportEntry({
        conflictId: conflictIdFor({
          type: "cyclic",
          cycle,
        }),
        conflictType: CONFLICT_TYPE.UNRESOLVED_REFERENCE,
        sourceReference: cycle,
        explanation: "Cyclic reference detected",
      })
    );
  }

  // Deterministic ordering.
  idEntries.sort((a, b) =>
    compareStableString(
      `${a.sourceNamespace}:${a.entityType}:${a.sourceId}`,
      `${b.sourceNamespace}:${b.entityType}:${b.sourceId}`
    )
  );
  conflicts.sort((a, b) => compareStableString(a.conflictId, b.conflictId));

  const plan = createIdMappingPlan({
    entries: idEntries,
    references: refEntries,
  });

  const mappingPlanFingerprint = sha256Canonical({
    packageFingerprint: input.packageFingerprint ?? null,
    targetRevisionFingerprint: input.targetRevisionFingerprint ?? null,
    selectedModules: selected,
    mappingPolicy,
    entries: idEntries.map((e) => ({
      sourceNamespace: e.sourceNamespace,
      sourceId: e.sourceId,
      entityType: e.entityType,
      targetNamespace: e.targetNamespace,
      targetId: e.targetId,
      action: e.action,
    })),
  });

  return Object.freeze({
    plan,
    idMappings: plan.entries,
    referenceMappings: plan.references,
    conflicts: createConflictReport({ conflicts }).conflicts,
    conflictReport: createConflictReport({ conflicts }),
    mappingPlanFingerprint,
    selectedModules: Object.freeze(selected),
  });
}

/**
 * @param {Map<string, string[]>} edges
 * @returns {string[]}
 */
function detectCycles(edges) {
  /** @type {string[]} */
  const cycles = [];
  const visiting = new Set();
  const visited = new Set();

  /**
   * @param {string} node
   * @param {string[]} stack
   */
  function dfs(node, stack) {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node);
      cycles.push(stack.slice(idx).concat(node).join("->"));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const next of edges.get(node) ?? []) {
      dfs(next, stack);
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of edges.keys()) {
    dfs(node, []);
  }
  return cycles;
}
