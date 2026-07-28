import { guardCrmLegacyLocalAccess } from "../runtime/resolveCrmLegacyRuntime.js";
import { CRM_LEGACY_ERROR_CODE } from "../runtime/constants.js";

const STORAGE_PREFIX = "pickleball-crm-templates-v1::";

function storageKey(clubId) {
  return `${STORAGE_PREFIX}${clubId}`;
}

function blockedResult(gate) {
  return {
    ok: false,
    code: gate.code || CRM_LEGACY_ERROR_CODE.MUTATION_BLOCKED,
    error: gate.error || gate.code,
    legacyBlocked: true,
  };
}

function readTemplates(clubId) {
  try {
    const raw = localStorage.getItem(storageKey(clubId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeTemplates(clubId, templates) {
  localStorage.setItem(storageKey(clubId), JSON.stringify(templates));
}

function makeId() {
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function listTemplatesResult(clubId, { channel } = {}, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return { ...blockedResult(gate), items: [] };

  let templates = readTemplates(gate.clubId);
  if (channel) templates = templates.filter((row) => row.channel === channel);
  templates.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return { ok: true, items: templates };
}

export function listTemplates(clubId, options = {}, env) {
  return listTemplatesResult(clubId, options, env).items;
}

export function createTemplate(clubId, payload = {}, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return blockedResult(gate);

  const templates = readTemplates(gate.clubId);
  const template = {
    id: makeId(),
    name: String(payload.name || "").trim() || "Mẫu mới",
    channel: String(payload.channel || "sms").trim(),
    subject: String(payload.subject || "").trim(),
    body: String(payload.body || "").trim(),
    variables: Array.isArray(payload.variables) ? payload.variables : [],
    createdAt: new Date().toISOString(),
  };
  templates.push(template);
  writeTemplates(gate.clubId, templates);
  return { ok: true, data: template };
}

export function updateTemplate(clubId, templateId, patch = {}, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return blockedResult(gate);

  const templates = readTemplates(gate.clubId);
  const index = templates.findIndex((row) => row.id === templateId);
  if (index < 0) return { ok: false, code: "CRM_TEMPLATE_NOT_FOUND", error: "Không tìm thấy mẫu." };

  templates[index] = {
    ...templates[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeTemplates(gate.clubId, templates);
  return { ok: true, data: templates[index] };
}

export function deleteTemplate(clubId, templateId, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return blockedResult(gate);
  const templates = readTemplates(gate.clubId).filter((row) => row.id !== templateId);
  writeTemplates(gate.clubId, templates);
  return { ok: true };
}

export function clearCrmTemplates(clubId, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return blockedResult(gate);
  localStorage.removeItem(storageKey(gate.clubId));
  return { ok: true };
}
