# Phase 6 — exact anonymous RPC allowlist remediation

Status: **PREPARED ONLY — NOT APPLIED**

This package converts Staging from default anonymous function execution to an
exact seven-overload allowlist. It was prepared under:

`OWNER GO — PREPARE EXACT ANON RPC ALLOWLIST REMEDIATION`

Preparation is not authorization to apply it.

## Intended anonymous contracts

- public news query: 1 overload
- public catalog reads: 4 overloads
- token-scoped referee read/write: 2 overloads

All other `public` `SECURITY DEFINER` functions lose `EXECUTE` for both the
pseudo-role `PUBLIC` and `anon`. Authenticated and service-role privileges are
unchanged.

The migration also removes `anon` from the `postgres` default function ACL in
schema `public`, preventing new functions from silently becoming anonymous API
endpoints. A locked `phase6_internal` snapshot records the exact pre-apply ACL
for rollback.

## Apply gate

Do not apply without this new exact checkpoint:

`OWNER GO — APPLY STAGING EXACT ANON RPC ALLOWLIST REMEDIATION`

After apply, run `02_VERIFY.sql`, anonymous positive QA for all seven overloads,
negative QA for representative privileged RPC families, then authenticated
Tenant A/B regression. Keep the snapshot until Owner accepts certification.

