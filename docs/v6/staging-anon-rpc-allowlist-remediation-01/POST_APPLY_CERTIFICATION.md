# Exact anonymous RPC allowlist — Staging post-apply certification

**Migration:** `20260804082418 / phase6_staging_exact_anon_rpc_allowlist_remediation_01`  
**Production mutation:** `0`  
**Production GO:** `NO`

## PASS

- Exact pre-apply ACL snapshot: 298/298 `SECURITY DEFINER` functions.
- Anonymous callable overloads: 204 → 7.
- Pseudo-`PUBLIC` executable ACLs: 151 → 0.
- Future `postgres` functions no longer inherit anonymous execution.
- All seven intended anonymous overloads returned HTTP 200.
- Three privileged RPC families returned HTTP 401 for anonymous callers.
- Token-scoped referee write QA used a deliberately invalid token and produced
  no valid mutation.
- Authenticated Owner A/B read-only regression remained PASS with no foreign
  tenant visibility (`club_data_v3_safe` empty-fixture observation retained).
- Security Advisor remains at 0 ERROR. Its seven anonymous warnings are the
  exact intentional allowlist.

The 271 authenticated warnings remain an architectural observation: guarded
authenticated RPC execution is expected and continues to require role/Tenant QA.

