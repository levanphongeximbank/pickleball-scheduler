/**
 * In-memory CrmTaskRepository — tenant/venue isolated per instance.
 * Defensive cloning via freeze. No localStorage / Supabase / global store.
 */

import { isCrmTaskTerminalStatus } from "../../constants/taskStatuses.js";
import { createCrmTask } from "../../models/task.js";
import { createScopedMemoryStore, resolveScope } from "./scopedMemoryStore.js";

/**
 * Deterministic task list order:
 * 1. Non-terminal before terminal
 * 2. dueAt ascending (missing dueAt sorts last — explicit Phase 1E rule)
 * 3. createdAt ascending
 * 4. taskId ascending
 *
 * @param {object} a
 * @param {object} b
 */
export function compareTasksList(a, b) {
  const aTerminal = isCrmTaskTerminalStatus(a.status) ? 1 : 0;
  const bTerminal = isCrmTaskTerminalStatus(b.status) ? 1 : 0;
  if (aTerminal !== bTerminal) return aTerminal - bTerminal;

  const aDue = a.dueAt ? String(a.dueAt) : "\uffff";
  const bDue = b.dueAt ? String(b.dueAt) : "\uffff";
  if (aDue < bDue) return -1;
  if (aDue > bDue) return 1;

  const createdCmp = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  if (createdCmp !== 0) return createdCmp;
  return String(a.taskId || "").localeCompare(String(b.taskId || ""));
}

function matchesTaskFilters(row, filters = {}, nowIso = null) {
  if (filters.contactRefId && row.contactRefId !== String(filters.contactRefId)) return false;
  if (filters.leadId && row.leadId !== String(filters.leadId)) return false;
  if (filters.opportunityId && row.opportunityId !== String(filters.opportunityId)) return false;
  const assignee =
    filters.assignedToActorId != null
      ? filters.assignedToActorId
      : filters.assigneeUserId;
  if (assignee && row.assignedToActorId !== String(assignee)) return false;
  if (filters.status && row.status !== String(filters.status)) return false;
  if (filters.priority && row.priority !== String(filters.priority)) return false;
  if (filters.dueFrom) {
    if (!row.dueAt || String(row.dueAt) < String(filters.dueFrom)) return false;
  }
  if (filters.dueTo) {
    if (!row.dueAt || String(row.dueAt) > String(filters.dueTo)) return false;
  }
  if (filters.overdueOnly) {
    if (!nowIso || !row.dueAt) return false;
    if (isCrmTaskTerminalStatus(row.status)) return false;
    if (String(row.dueAt) >= String(nowIso)) return false;
  }
  return true;
}

export function createMemoryTaskRepository() {
  const store = createScopedMemoryStore();

  function create(scopeInput, taskInput) {
    const scope = resolveScope(scopeInput);
    const task = createCrmTask({
      ...taskInput,
      tenantId: scope.tenantId,
      venueId: scope.venueId,
    });
    return store.save(scope, task.taskId, task);
  }

  function update(scopeInput, taskInput) {
    const scope = resolveScope(scopeInput);
    const taskId = String(taskInput?.taskId || taskInput?.id || "");
    const existing = store.getById(scope, taskId);
    if (!existing) {
      throw new Error(`Task not found for update: ${taskId}`);
    }
    const task = createCrmTask({
      ...existing,
      ...taskInput,
      taskId: existing.taskId,
      tenantId: scope.tenantId,
      venueId: scope.venueId,
    });
    return store.save(scope, task.taskId, task);
  }

  return {
    create,
    update,
    /** Phase 1B alias — creates or overwrites */
    save(scopeInput, taskInput) {
      const scope = resolveScope(scopeInput);
      const taskId = String(taskInput?.taskId || taskInput?.id || "");
      const existing = store.getById(scope, taskId);
      if (existing) return update(scope, taskInput);
      return create(scope, taskInput);
    },
    getById(scopeInput, taskId) {
      const scope = resolveScope(scopeInput);
      return store.getById(scope, String(taskId || ""));
    },
    list(scopeInput, filters = {}) {
      const scope = resolveScope(scopeInput);
      const nowIso = filters.nowIso != null ? String(filters.nowIso) : null;
      const rows = store.list(scope, (row) => matchesTaskFilters(row, filters, nowIso));
      return rows.slice().sort(compareTasksList);
    },
  };
}
