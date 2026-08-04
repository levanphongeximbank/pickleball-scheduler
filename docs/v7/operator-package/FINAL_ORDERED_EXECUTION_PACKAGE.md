# Phase 7 Final Ordered Execution Package — NOT AUTHORIZED

This package stops at the Owner Production GO checkpoint.

1. Freeze `origin/main`, deployment SHA, target ref, artifact hashes, operators and window.
2. Verify backup timestamp, restore authority, Storage recovery and prior healthy deployment.
3. Run only the reviewed Management API read-only query manifest.
4. Reconcile migration/schema/RLS/RBAC/tenant/anon/PUBLIC results against M0–M11 expected state.
5. Verify environment metadata, fail-closed flag values, domain/CORS and monitoring routes without mutation.
6. Record Database Operator, Release Operator, QA Observer and Communication Owner acceptance.
7. Re-run validation and issue `PHASE7_RELEASE_DECISION_GO_READY` only if G1–G13 and G15 pass.
8. Stop at Owner GO checkpoint.

There is no hidden M2 step: its required catalog verification is covered by the tracked `tables_rls`, `policies`, `routines`, grants, migrations and publication queries in `QUERY_MANIFEST.json`.

Any later SQL, deploy, environment/flag/traffic/domain change or rollback requires a separate explicit Owner Production GO bound to the exact target, SHA, package and window.
