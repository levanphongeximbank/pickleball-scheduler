/**
 * In-memory CrmTagRepository — tenant/venue isolated per instance.
 */

import { createCrmTag, compareTagsList, normalizeTagCode } from "../../models/tag.js";
import { createScopedMemoryStore, resolveScope } from "./scopedMemoryStore.js";

export function createMemoryTagRepository() {
  const store = createScopedMemoryStore();

  /** @type {Map<string, string>} scopeKey::code → tagId */
  const codeIndex = new Map();

  function scopeCodeKey(scope, code) {
    return `${scope.tenantId}::${scope.venueId}::${code}`;
  }

  function create(scopeInput, tagInput) {
    const scope = resolveScope(scopeInput);
    const tag = createCrmTag({
      ...tagInput,
      tenantId: scope.tenantId,
      venueId: scope.venueId,
    });
    const codeKey = scopeCodeKey(scope, tag.code);
    const existingId = codeIndex.get(codeKey);
    if (existingId && existingId !== tag.tagId) {
      throw new Error(`Duplicate tag code in scope: ${tag.code}`);
    }
    codeIndex.set(codeKey, tag.tagId);
    return store.save(scope, tag.tagId, tag);
  }

  function update(scopeInput, tagInput) {
    const scope = resolveScope(scopeInput);
    const tagId = String(tagInput?.tagId || "");
    const existing = store.getById(scope, tagId);
    if (!existing) {
      throw new Error(`Tag not found for update: ${tagId}`);
    }
    const tag = createCrmTag({
      ...existing,
      ...tagInput,
      tagId: existing.tagId,
      tenantId: scope.tenantId,
      venueId: scope.venueId,
    });
    if (existing.code !== tag.code) {
      const oldKey = scopeCodeKey(scope, existing.code);
      if (codeIndex.get(oldKey) === existing.tagId) {
        codeIndex.delete(oldKey);
      }
      const newKey = scopeCodeKey(scope, tag.code);
      const conflict = codeIndex.get(newKey);
      if (conflict && conflict !== tag.tagId) {
        throw new Error(`Duplicate tag code in scope: ${tag.code}`);
      }
      codeIndex.set(newKey, tag.tagId);
    }
    return store.save(scope, tag.tagId, tag);
  }

  return {
    create,
    update,
    getById(scopeInput, tagId) {
      const scope = resolveScope(scopeInput);
      return store.getById(scope, String(tagId || ""));
    },
    getByCode(scopeInput, codeInput) {
      const scope = resolveScope(scopeInput);
      const code = normalizeTagCode(codeInput);
      const tagId = codeIndex.get(scopeCodeKey(scope, code));
      if (!tagId) return null;
      return store.getById(scope, tagId);
    },
    list(scopeInput, filters = {}) {
      const scope = resolveScope(scopeInput);
      const rows = store.list(scope, (row) => {
        if (filters.active === true && row.active !== true) return false;
        if (filters.active === false && row.active !== false) return false;
        if (filters.code && row.code !== normalizeTagCode(filters.code)) return false;
        return true;
      });
      return rows.slice().sort(compareTagsList);
    },
  };
}
