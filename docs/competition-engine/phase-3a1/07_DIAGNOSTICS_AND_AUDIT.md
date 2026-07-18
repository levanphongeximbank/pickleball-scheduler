# 07 — Diagnostics and Audit

## Diagnostics

```text
{ code, severity: INFO|WARNING|ERROR|BLOCKER, path, message, metadata }
```

## Audit event contract

`createRuntimeAuditEvent` builds a JSON-safe object attached to each decision.

**Not** written to database or logging services in Phase 3A.1.
