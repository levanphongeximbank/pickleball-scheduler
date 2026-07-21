import { createCrmTask } from "../../models/task.js";
import { createScopedMemoryStore, resolveScope } from "./scopedMemoryStore.js";

export function createMemoryTaskRepository() {
  const store = createScopedMemoryStore();

  return {
    save(scopeInput, taskInput) {
      const scope = resolveScope(scopeInput);
      const task = createCrmTask({
        ...taskInput,
        tenantId: scope.tenantId,
        venueId: scope.venueId,
      });
      return store.save(scope, task.taskId, task);
    },
    getById(scopeInput, taskId) {
      const scope = resolveScope(scopeInput);
      return store.getById(scope, String(taskId || ""));
    },
    list(scopeInput, filters = {}) {
      const scope = resolveScope(scopeInput);
      return store.list(scope, (row) => {
        if (filters.status && row.status !== filters.status) return false;
        if (filters.assigneeUserId && row.assigneeUserId !== filters.assigneeUserId) return false;
        return true;
      });
    },
    delete(scopeInput, taskId) {
      const scope = resolveScope(scopeInput);
      return store.delete(scope, String(taskId || ""));
    },
  };
}
