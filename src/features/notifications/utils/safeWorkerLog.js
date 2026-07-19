/**
 * Structured worker logging — never log secrets or full PII.
 */

const SECRET_PATTERNS = [
  /postgres(ql)?:\/\/[^\s]+/gi,
  /(?<=(password|secret|token|apikey|api_key|authorization|bearer)\s*[=:]\s*)[^\s,;]+/gi,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
];

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;

export function truncateSafeId(id, keep = 8) {
  const s = String(id || "");
  if (s.length <= keep) return s;
  return `${s.slice(0, keep)}…`;
}

export function redactSecrets(value) {
  let text = String(value ?? "");
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, "[REDACTED]");
  }
  text = text.replace(EMAIL_PATTERN, (m) => {
    const at = m.indexOf("@");
    if (at <= 0) return "[email]";
    return `${m.slice(0, 1)}***${m.slice(at)}`;
  });
  text = text.replace(PHONE_PATTERN, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length < 8) return m;
    return `***${digits.slice(-4)}`;
  });
  return text;
}

/**
 * Build a structured worker log line (object). Safe for console/JSON logs.
 */
export function buildWorkerLogEntry({
  runId,
  workerId,
  environment,
  jobId = null,
  transition = null,
  result = null,
  durationMs = null,
  retryDecision = null,
  message = null,
} = {}) {
  return {
    level: "info",
    component: "notification_delivery_worker",
    run_id: runId ? truncateSafeId(runId, 12) : null,
    worker_id: workerId ? truncateSafeId(workerId, 16) : null,
    environment: environment || null,
    job_id: jobId ? truncateSafeId(jobId, 8) : null,
    transition: transition || null,
    result: result || null,
    duration_ms: durationMs == null ? null : Number(durationMs),
    retry_decision: retryDecision || null,
    message: message ? redactSecrets(message).slice(0, 200) : null,
  };
}

export function assertLogHasNoSecrets(entry) {
  const raw = JSON.stringify(entry || {});
  const lower = raw.toLowerCase();
  const banned = [
    "password=",
    "secret=",
    "bearer ",
    "postgres://",
    "postgresql://",
    "service_role",
    "eyj",
  ];
  for (const b of banned) {
    if (lower.includes(b) && !lower.includes("[redacted]")) {
      // allow truncated ids; fail on obvious secret markers
      if (b === "eyj" && !/eyj[a-z0-9_-]{20,}/i.test(raw)) continue;
      return { ok: false, error: `secret_marker:${b}` };
    }
  }
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(raw) && !raw.includes("***")) {
    return { ok: false, error: "full_email_in_log" };
  }
  return { ok: true };
}
