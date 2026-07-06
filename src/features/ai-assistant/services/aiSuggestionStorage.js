import {
  AI_SUGGESTION_STATUS,
  AI_SUGGESTION_TTL_HOURS,
  AI_SUGGESTION_TYPE,
} from "../constants/aiConfig.js";
import {
  buildSuggestionRecord,
  cloudGetSuggestionById,
  cloudInsertSuggestion,
  cloudListSuggestions,
  cloudUpdateSuggestion,
  isAiSuggestionCloudEnabled,
} from "./supabaseSuggestionStorage.js";
import {
  cloudGetChecklistItem,
  cloudHydrateChecklist,
  cloudSetChecklistItem,
  isAiChecklistCloudEnabled,
} from "./supabaseChecklistStorage.js";

const STORAGE_KEY = "pickleball-ai-suggestions-v1";

/** @type {Array<Object>|null} */
let memoryStore = null;

/** @type {Map<string, Object>} */
const cloudMemoryIndex = new Map();

function memoryKey(tenantId, id) {
  return `${tenantId}::${id}`;
}

function getMemoryStore() {
  return typeof localStorage === "undefined";
}

function loadAll() {
  if (getMemoryStore()) {
    return memoryStore ? [...memoryStore] : [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(records) {
  const slice = records.slice(-500);
  if (getMemoryStore()) {
    memoryStore = slice;
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slice));
}

function upsertMemoryRecord(record) {
  cloudMemoryIndex.set(memoryKey(record.tenantId, record.id), record);
  const all = loadAll().filter((item) => item.id !== record.id);
  all.push(record);
  saveAll(all);
}

function createId() {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isExpired(record) {
  if (!record.expiresAt) {
    return false;
  }
  return new Date(record.expiresAt).getTime() < Date.now();
}

export function saveSuggestion({
  tenantId,
  tournamentId,
  type,
  inputSnapshot,
  outputPayload,
  confidence,
  createdBy,
}) {
  if (isAiSuggestionCloudEnabled()) {
    const record = buildSuggestionRecord({
      tenantId,
      tournamentId,
      type,
      inputSnapshot,
      outputPayload,
      confidence,
      createdBy,
    });
    upsertMemoryRecord(record);
    void cloudInsertSuggestion(record).then((result) => {
      if (!result?.ok && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ai-suggestion:cloud-error", {
            detail: { error: result.error || "Lưu gợi ý cloud thất bại." },
          })
        );
      }
    });
    return record;
  }

  const expiresAt = new Date(
    Date.now() + AI_SUGGESTION_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();

  const record = {
    id: createId(),
    tenantId: String(tenantId),
    tournamentId: String(tournamentId),
    type,
    status: AI_SUGGESTION_STATUS.PENDING,
    inputSnapshot: inputSnapshot || {},
    outputPayload: outputPayload || {},
    confidence: confidence || "medium",
    createdBy: createdBy || "",
    createdAt: new Date().toISOString(),
    appliedBy: null,
    appliedAt: null,
    dismissedBy: null,
    dismissedAt: null,
    expiresAt,
  };

  const all = loadAll();
  all.push(record);
  saveAll(all);
  return record;
}

export async function hydrateSuggestionsFromCloud(tournamentId, tenantId) {
  if (!isAiSuggestionCloudEnabled()) {
    return { ok: true, skipped: true };
  }

  const result = await cloudListSuggestions(tournamentId, tenantId);
  if (!result.ok) {
    return result;
  }

  for (const record of result.suggestions) {
    upsertMemoryRecord(record);
  }

  return { ok: true, count: result.suggestions.length };
}

export function getSuggestionById(suggestionId, tenantId) {
  const cached = cloudMemoryIndex.get(memoryKey(tenantId, suggestionId));
  if (cached) {
    return cached;
  }

  const all = loadAll();
  const record = all.find(
    (item) => item.id === suggestionId && item.tenantId === String(tenantId)
  );
  if (!record) {
    if (isAiSuggestionCloudEnabled()) {
      void cloudGetSuggestionById(suggestionId, tenantId).then((result) => {
        if (result.ok && result.record) {
          upsertMemoryRecord(result.record);
        }
      });
    }
    return null;
  }
  if (isExpired(record) && record.status === AI_SUGGESTION_STATUS.PENDING) {
    record.status = AI_SUGGESTION_STATUS.EXPIRED;
    saveAll(all.map((item) => (item.id === record.id ? record : item)));
    if (isAiSuggestionCloudEnabled()) {
      void cloudUpdateSuggestion(suggestionId, tenantId, { status: AI_SUGGESTION_STATUS.EXPIRED });
    }
  }
  return record;
}

export function listSuggestions(tournamentId, tenantId, filters = {}) {
  const { type = null, status = null } = filters;
  return loadAll()
    .filter((item) => {
      if (item.tournamentId !== String(tournamentId)) {
        return false;
      }
      if (item.tenantId !== String(tenantId)) {
        return false;
      }
      if (type && item.type !== type) {
        return false;
      }
      if (status && item.status !== status) {
        return false;
      }
      if (isExpired(item) && item.status === AI_SUGGESTION_STATUS.PENDING) {
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function updateSuggestionStatus(suggestionId, tenantId, patch) {
  const all = loadAll();
  const index = all.findIndex(
    (item) => item.id === suggestionId && item.tenantId === String(tenantId)
  );
  if (index < 0) {
    return { ok: false, error: "Không tìm thấy đề xuất AI." };
  }

  const current = all[index];
  if (isExpired(current) && current.status === AI_SUGGESTION_STATUS.PENDING) {
    return { ok: false, error: "Đề xuất AI đã hết hạn.", code: "EXPIRED" };
  }

  if (current.status !== AI_SUGGESTION_STATUS.PENDING) {
    return {
      ok: false,
      error: `Đề xuất đã ở trạng thái "${current.status}".`,
      code: "INVALID_STATUS",
    };
  }

  const next = { ...current, ...patch };
  all[index] = next;
  saveAll(all);
  upsertMemoryRecord(next);

  if (isAiSuggestionCloudEnabled()) {
    void cloudUpdateSuggestion(suggestionId, tenantId, patch).then((result) => {
      if (!result?.ok && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ai-suggestion:cloud-error", {
            detail: { error: result.error || "Cập nhật gợi ý cloud thất bại." },
          })
        );
      }
    });
  }

  return { ok: true, suggestion: next };
}

export function clearTournamentSuggestions(tournamentId, tenantId) {
  const all = loadAll().filter(
    (item) =>
      !(item.tournamentId === String(tournamentId) && item.tenantId === String(tenantId))
  );
  saveAll(all);
}

export { AI_SUGGESTION_TYPE, AI_SUGGESTION_STATUS };

const CHECKLIST_STORAGE_KEY = "pickleball-ai-workflow-checklist-v1";

function hasChecklistScope(scope) {
  return Boolean(scope?.tenantId && scope?.tournamentId);
}

function loadChecklistState() {
  if (typeof localStorage === "undefined") {
    return {};
  }
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveChecklistState(state) {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(state));
}

export function getChecklistState(key, scope = null) {
  if (isAiChecklistCloudEnabled() && hasChecklistScope(scope)) {
    return cloudGetChecklistItem(scope.tenantId, scope.tournamentId, key);
  }
  const state = loadChecklistState();
  return state[key] || false;
}

export function setChecklistState(key, value, scope = null) {
  if (isAiChecklistCloudEnabled() && hasChecklistScope(scope)) {
    void cloudSetChecklistItem(scope.tenantId, scope.tournamentId, key, value);
    return Boolean(value);
  }
  const state = loadChecklistState();
  state[key] = Boolean(value);
  saveChecklistState(state);
  return state[key];
}

export async function hydrateChecklistFromCloud(tournamentId, tenantId) {
  if (!isAiChecklistCloudEnabled()) {
    return { ok: true, skipped: true };
  }
  return cloudHydrateChecklist(tournamentId, tenantId);
}

export function getChecklistProgress(items = [], scope = null) {
  const entries = (Array.isArray(items) ? items : [])
    .map((item) => (typeof item === "string" ? { title: item, completed: false } : item))
    .filter((item) => item?.title);
  const total = entries.length;
  if (!total) {
    return { total: 0, completed: 0, percent: 0, isComplete: false };
  }
  const completed = entries.filter(
    (item) => Boolean(item.completed) || getChecklistState(item.title, scope)
  ).length;
  return {
    total,
    completed,
    percent: Math.round((completed / total) * 100),
    isComplete: completed === total,
  };
}

export function clearChecklistState() {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(CHECKLIST_STORAGE_KEY);
}
