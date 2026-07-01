const TEMPLATES_KEY = "pickleball-notification-templates-v1";
const JOBS_KEY = "pickleball-notification-jobs-v1";
const LOGS_KEY = "pickleball-notification-logs-v1";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadNotificationTemplates() {
  return readJson(TEMPLATES_KEY, []);
}

export function saveNotificationTemplates(items) {
  writeJson(TEMPLATES_KEY, items || []);
}

export function loadNotificationJobs() {
  return readJson(JOBS_KEY, []);
}

export function saveNotificationJobs(items) {
  writeJson(JOBS_KEY, items || []);
}

export function loadNotificationLogs() {
  return readJson(LOGS_KEY, []);
}

export function saveNotificationLogs(items) {
  writeJson(LOGS_KEY, items || []);
}

export function clearNotificationStorage() {
  localStorage.removeItem(TEMPLATES_KEY);
  localStorage.removeItem(JOBS_KEY);
  localStorage.removeItem(LOGS_KEY);
}
