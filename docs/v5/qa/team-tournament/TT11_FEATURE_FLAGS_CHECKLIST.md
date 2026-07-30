# TT-11 — Feature Flags Checklist

**Environment:** Development ☐ / Preview ☐ / Staging ☐ / Production ☐  
**Date captured:** _______________

> Do not change flags on QA prep branch. Record current values during TT-11 execution.

---

| Flag | Current value | Target env | Owner | Rollback value | Evidence | Status |
|------|---------------|------------|-------|----------------|----------|--------|
| `VITE_TEAM_TOURNAMENT_DATA_MODE` | | staging | Tech | `legacy` | TT-1C report | ☐ |
| `VITE_RBAC_ENABLED` | | staging | Tech | previous | env screenshot | ☐ |
| `VITE_COMPETITION_CORE_STANDINGS_V2_ENABLED` | | staging | Tech | `false` | CC-07 doc | ☐ |
| `VITE_COMPETITION_CORE_DRAW_V2_ENABLED` | | staging | Tech | `false` | CC-04 doc | ☐ |
| Team tournament portal enabled | | staging | Product | off | menu audit | ☐ |
| Referee token RPC enabled | | staging | Tech | off | TT-5 evidence | ☐ |
| DreamBreaker enabled (tournament setting) | `false` | pilot | Product | `false` | tt10 fixture | ☐ |
| Mobile shell / PWA | | staging | QA | previous | TT-9 | ☐ |
| AI assistant (`VITE_ENABLE_AI_ENGINE`) | | all | Product | `false` | — | ☐ |

## Verification steps

- [ ] `probe-preview-flags.mjs` output archived
- [ ] Staging env matches Preview for team tournament flags
- [ ] Production flags **unchanged** until GO checklist G01–G16 pass
- [ ] Rollback values documented in deploy runbook

## Sign-off

| Role | Name | Date |
|------|------|------|
| Tech lead | | |
| Product owner | | |
