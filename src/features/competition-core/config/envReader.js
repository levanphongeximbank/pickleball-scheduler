/**
 * Read boolean-like env values safely. Missing/invalid → false.
 * @param {unknown} raw
 * @returns {boolean}
 */
export function parseEnvBoolean(raw) {
  if (raw === true || raw === 1) {
    return true;
  }
  if (raw === false || raw === 0 || raw == null) {
    return false;
  }

  const normalized = String(raw).trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (
    normalized === "false" ||
    normalized === "0" ||
    normalized === "no" ||
    normalized === "off" ||
    normalized === ""
  ) {
    return false;
  }

  return false;
}

/**
 * @param {string} name
 * @param {Record<string, unknown>|undefined|null} [envSource]
 * @returns {boolean}
 */
export function readEnvBoolean(name, envSource) {
  const env = envSource ?? import.meta.env ?? {};
  return parseEnvBoolean(env[name]);
}

/**
 * @param {string} name
 * @param {Record<string, unknown>|undefined|null} [envSource]
 * @returns {string}
 */
export function readEnvString(name, envSource) {
  const env = envSource ?? import.meta.env ?? {};
  const raw = env[name];
  return raw == null ? "" : String(raw);
}
