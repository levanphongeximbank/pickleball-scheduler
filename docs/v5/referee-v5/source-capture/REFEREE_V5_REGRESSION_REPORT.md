# Referee V5 Regression Report

**Date:** 2026-07-13  
**Branch:** `feature/referee-v5-platform`  
**Worktree:** `C:\Users\Le Phong\pickleball-scheduler-referee-v5`

| Suite | Result |
|-------|--------|
| Referee V5 unit (`tests/referee-v5/*.test.js`) | **133/133 PASS** |
| Referee V5 UI (`tests/ui/referee-v5-c.test.jsx`) | **36/36 PASS** (after singles test alignment) |
| Legacy referee | **29/29 PASS** |
| Team Tournament (referee + workflow + core) | **30/30 PASS** |
| Build (`npm run build`) | **PASS** |
| Referee V5 scoped lint | **PASS** |
| HTTP staging harness | Not re-run (requires staging secrets) |
| Browser E2E staging | Not re-run (requires staging secrets) |

## Notes

- `npm ci` required in clean worktree before tests.
- Repo-wide `npm run lint` not executed in this capture pass; scoped lint PASS.
