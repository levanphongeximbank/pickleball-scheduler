/**
 * In-memory CrmTagAssignmentRepository — tenant/venue isolated per instance.
 */

import {
  createTagAssignment,
  compareTagAssignmentsList,
} from "../../models/tag.js";
import { createScopedMemoryStore, resolveScope } from "./scopedMemoryStore.js";

export function createMemoryTagAssignmentRepository() {
  const store = createScopedMemoryStore();

  /** @type {Map<string, string>} scope::targetType::targetId::tagId → assignmentId */
  const targetTagIndex = new Map();

  function targetTagKey(scope, targetType, targetId, tagId) {
    return `${scope.tenantId}::${scope.venueId}::${targetType}::${targetId}::${tagId}`;
  }

  function create(scopeInput, assignmentInput) {
    const scope = resolveScope(scopeInput);
    const assignment = createTagAssignment({
      ...assignmentInput,
      tenantId: scope.tenantId,
      venueId: scope.venueId,
    });
    const idxKey = targetTagKey(
      scope,
      assignment.targetType,
      assignment.targetId,
      assignment.tagId
    );
    const existingId = targetTagIndex.get(idxKey);
    if (existingId) {
      const existing = store.getById(scope, existingId);
      if (existing) return existing;
    }
    targetTagIndex.set(idxKey, assignment.assignmentId);
    return store.save(scope, assignment.assignmentId, assignment);
  }

  return {
    create,
    getByTargetAndTag(scopeInput, targetType, targetId, tagId) {
      const scope = resolveScope(scopeInput);
      const idxKey = targetTagKey(
        scope,
        String(targetType),
        String(targetId),
        String(tagId)
      );
      const assignmentId = targetTagIndex.get(idxKey);
      if (!assignmentId) return null;
      return store.getById(scope, assignmentId);
    },
    listByTarget(scopeInput, targetType, targetId) {
      const scope = resolveScope(scopeInput);
      const type = String(targetType || "");
      const id = String(targetId || "");
      const rows = store.list(
        scope,
        (row) => row.targetType === type && row.targetId === id
      );
      return rows.slice().sort(compareTagAssignmentsList);
    },
    listByTag(scopeInput, tagId) {
      const scope = resolveScope(scopeInput);
      const id = String(tagId || "");
      const rows = store.list(scope, (row) => row.tagId === id);
      return rows.slice().sort(compareTagAssignmentsList);
    },
    remove(scopeInput, assignmentId) {
      const scope = resolveScope(scopeInput);
      const id = String(assignmentId || "");
      const existing = store.getById(scope, id);
      if (!existing) return false;
      const idxKey = targetTagKey(
        scope,
        existing.targetType,
        existing.targetId,
        existing.tagId
      );
      if (targetTagIndex.get(idxKey) === id) {
        targetTagIndex.delete(idxKey);
      }
      return store.delete(scope, id);
    },
  };
}
