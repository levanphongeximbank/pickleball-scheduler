# CLUBS-RLS-REMEDIATION-01 — Stop Conditions

Abort immediately (no further apply / no Production escalate) if any of:

1. **Baseline drift** — worktree HEAD is not descendant of locked baseline `adc43eb3979292a09687cf099404235583f7895e`, or unexpected dirty files outside remediation scope.
2. **Wrong target** — connection / project ref is Production `expuvcohlcjzvrrauvud` without a separate Production GO package.
3. **Competing policy** — >1 SELECT policy on `public.clubs`, or unknown policy names besides `clubs_select`.
4. **Writer conflict** — INSERT/UPDATE/DELETE policies appear on `public.clubs`, or authenticated gains writer grants beyond design.
5. **Broad branch persists** — post-apply regex still detects bare club-row `status = 'active'` in `clubs_select`.
6. **N1/N2 fail** — cross-tenant authenticated direct SELECT still returns foreign active clubs / internal metadata.
7. **Catalog regression** — `public_catalog_list_clubs` missing, EXECUTE revoked, or returns non-allowlisted columns.
8. **Legitimate path break** — SA / same-tenant member / active club member cannot read allowed rows; Club Management RPC smoke fails.
9. **Package/lock drift** — unintended `package.json` / `package-lock.json` changes.
10. **Secret exposure** — any evidence artifact would print JWTs, service role keys, or passwords.

On abort after forward on Staging: run rollback SQL, capture evidence, escalate Owner.
