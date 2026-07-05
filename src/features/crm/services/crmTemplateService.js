const STORAGE_PREFIX = "pickleball-crm-templates-v1::";

function storageKey(clubId) {
  return `${STORAGE_PREFIX}${clubId}`;
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

export function listTemplates(clubId, { channel } = {}) {
  let templates = readTemplates(clubId);
  if (channel) {
    templates = templates.filter((row) => row.channel === channel);
  }
  return templates.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function createTemplate(clubId, payload = {}) {
  const templates = readTemplates(clubId);
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
  writeTemplates(clubId, templates);
  return template;
}

export function updateTemplate(clubId, templateId, patch = {}) {
  const templates = readTemplates(clubId);
  const index = templates.findIndex((row) => row.id === templateId);
  if (index < 0) return null;

  templates[index] = {
    ...templates[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeTemplates(clubId, templates);
  return templates[index];
}

export function deleteTemplate(clubId, templateId) {
  const templates = readTemplates(clubId).filter((row) => row.id !== templateId);
  writeTemplates(clubId, templates);
  return true;
}

export function clearCrmTemplates(clubId) {
  localStorage.removeItem(storageKey(clubId));
}
