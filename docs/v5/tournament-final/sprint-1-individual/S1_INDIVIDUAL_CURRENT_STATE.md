# S1 — Individual Tournament: Current State

**Sprint:** Tournament V5 Sprint 1 — Individual Tournament  
**Phase:** **Sprint 1 batches S1-A → S1-H complete (2026-07-14)** — awaiting Owner staging sign-off  
**Date:** 2026-07-14  
**Branch:** working tree (feature / local)  
**Deploy:** Not deployed · **Merge:** Not merged

---

## Executive summary

Individual tournaments remain **club-blob SSOT** (pilot), with full Sprint 1 feature surface closed:

| Capability | Status |
|------------|--------|
| Draw / schedule publish-lock | ✅ S1-A / S1-E |
| Registration + eligibility + fees | ✅ S1-B / S1-C |
| Rating V5 seed + STANDINGS_V2 | ✅ S1-D |
| Referee assign + result propagation + correction | ✅ S1-F |
| Walkover / withdrawal / H3 / awards / close | ✅ S1-G |
| Player portal + public page + UX polish | ✅ S1-H |

**Functional baseline:** previously ~78% → **Sprint 1 DoD targeted 100% for pilot (blob path).**  
Strict cloud/RLS parity with Team Tournament remains optional (S1-GAP-001).

---

## Player entry points

| Route | Audience |
|-------|----------|
| `/tournament/:id/register` | Self-registration |
| `/tournament/my` | Player portal dashboard |
| `/tournament/:id/public` | Spectator read-only |

---

## Automated confidence

Local suite **86/86 PASS** (S1-A…H + engine + regression + v5-menu-audit).

---

## Owner next step

1. Staging smoke M1–M26  
2. Approve Sprint 1 Individual for pilot  
3. Explicit GO required before merge / production deploy
