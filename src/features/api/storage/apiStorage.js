const CLIENTS_KEY = "pickleball-api-clients-v1";
const KEYS_KEY = "pickleball-api-keys-v1";
const LOGS_KEY = "pickleball-api-logs-v1";
const LOG_CAP = 1000;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadApiClients() {
  return readJson(CLIENTS_KEY, []);
}

export function saveApiClients(clients) {
  writeJson(CLIENTS_KEY, clients || []);
}

export function loadApiKeys() {
  return readJson(KEYS_KEY, []);
}

export function saveApiKeys(keys) {
  writeJson(KEYS_KEY, keys || []);
}

export function loadApiLogs() {
  return readJson(LOGS_KEY, []);
}

export function saveApiLogs(logs) {
  writeJson(LOGS_KEY, logs || []);
}

export function appendApiLog(log) {
  const logs = loadApiLogs();
  logs.unshift(log);
  saveApiLogs(logs.slice(0, LOG_CAP));
}

export function clearApiStorage() {
  localStorage.removeItem(CLIENTS_KEY);
  localStorage.removeItem(KEYS_KEY);
  localStorage.removeItem(LOGS_KEY);
}
