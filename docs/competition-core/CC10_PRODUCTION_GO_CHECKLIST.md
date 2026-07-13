# CC-10 — Production GO Checklist

All items must be checked before any Production activation.

- [x] Staging shadow Stage 1 complete (Preview deployed, live verification PASS)
- [x] Zero BLOCKING shadow mismatches across 20-case matrix
- [x] Rating durability verified on staging (fixture RPC isolation)
- [ ] Rating durability verified on target environment
- [ ] Feature flag matrix verified (CC10_FEATURE_FLAG_MATRIX.md)
- [ ] Security audit pass (CC10_SECURITY_PERMISSION_AUDIT.md)
- [ ] Data safety pass (CC10_DATA_SAFETY_AUDIT.md)
- [ ] Full test suite pass on release commit
- [ ] Build pass on release commit
- [ ] Monitoring/alerting for parity mismatches available
- [ ] Rollback rehearsed (flag OFF + verify legacy within 5 min)
- [ ] Owner written GO approval
- [ ] Production change window scheduled
- [ ] Database backup/checkpoint confirmed
- [ ] Post-enable smoke test plan ready (draw, standings, one match result)

**Current status:** 4/14 satisfied — Production activation **BLOCKED** (monitoring, rollback rehearsal on Production N/A, owner GO).

Competition Core production activation: **NOT PERFORMED**.
