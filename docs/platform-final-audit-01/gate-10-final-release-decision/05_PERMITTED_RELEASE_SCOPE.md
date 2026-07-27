# Gate 10 — Permitted Release Scope

**Rule:** Current live routes ≠ every module Production-activated. Separate web continuity from full platform readiness.

## Scope approval matrix

| # | Scope | Classification | Notes |
|---|-------|----------------|-------|
| 1 | Existing web Production continuity | APPROVED_WITH_CONDITIONS | Keep `pickvn.app` live under registered conditions |
| 2 | Public portal and catalog | APPROVED_WITH_CONDITIONS | Clubs/Courts LIVE; Tournaments/Rankings LIVE_EMPTY honest-empty |
| 3 | Clubs and Courts runtime | APPROVED_WITH_CONDITIONS | Public surfaces + RLS remediation evidence; recoverability gaps remain |
| 4 | Authenticated multi-tenant workflows | APPROVED_WITH_CONDITIONS | Continuity allowed; `RC-RBAC-01` / env unread remain |
| 5 | Competition Engine | NOT_APPROVED | Local MVP only — separate rollout certification |
| 6 | Business Modules | NOT_APPROVED | Structural foundation / partial implementation — not GA |
| 7 | Intelligence and Analytics | NOT_APPROVED | Not Production-certified |
| 8 | Experience Channels | APPROVED_WITH_CONDITIONS | Certified channel surfaces only |
| 9 | Ecosystem and Integrations | NOT_APPROVED | Real providers / webhooks / live credentials absent |
| 10 | Mobile/PWA | APPROVED_WITH_CONDITIONS | Web PWA shell only |
| 11 | iOS App Store release | NOT_APPROVED | Store release not completed |
| 12 | Android Play Store release | NOT_APPROVED | Store release not completed |

---

## A. Existing Production web continuity

**Allowed to remain live:**

- Production alias `https://pickvn.app` and Vercel Production host for already-deployed main tip `e78bb8b…`
- Public `/`, `/clubs`, `/courts`
- PWA manifest / service worker shell
- Experience Channels surfaces already certified live
- Authenticated app shell already deployed (with RBAC env condition)

**Not proof of:** whole-platform GA, Competition Prod GO, Business Module GA, Ecosystem live connectors, store apps.

## B. Controlled pilot

**May be used by controlled pilot tenants for:**

- Public Clubs/Courts discovery workflows already LIVE
- Experience Channels certified surfaces
- Authenticated club/scheduling workflows already in Production code path — **pilot only**, with Owner monitoring and RBAC confirmation follow-up

**Not pilot-approved as GA marketing:** Competition Engine full platform, Business Module Club/Finance/CRM structural areas, Intelligence Prod, Ecosystem live providers.

## C. General availability

**NOT APPROVED** for whole-platform General Availability.

GA would require separate certification closing or accepting with Owner waiver at least:

- `RC-ENV-01`, `RC-RBAC-01`, `RC-MONITOR-01`
- Business Module per-module Prod activation (close `RC-BM-STRUCTURAL-01`)
- Competition remote/Prod activation (close `RC-COMP-MVP-01`)
- Traceability honesty (`B-AUDIT-TRACEABILITY-01` waived or reconstructed)
- Recovery gaps remain accepted only if Owner continues acceptance

## D. Mobile store release

| Store | Status |
|-------|--------|
| iOS App Store | NOT_APPROVED — requires separate store certification |
| Android Play Store | NOT_APPROVED — requires separate store certification |
| Web PWA | APPROVED_WITH_CONDITIONS (shell only) |

## E. External ecosystem activation

**NOT APPROVED** until:

- Real providers present and verified (`RC-ECO-PROVIDERS-01`)
- Live credentials/resolvers present where required
- Production webhooks/network clients present + smoke (`RC-WEBHOOK-01`)
- Separate ecosystem activation gate evidence

---

## What may be publicly announced

**Allowed (constrained honesty):**

- Pick VN / Pickleball Scheduler Pro web is available in Production for public Clubs/Courts discovery and certified Experience Channel surfaces
- Platform audit program completed with **conditional** release decision
- Security Clubs RLS remediation completed (without claiming zero residual recovery risk)

**Prohibited announcements:**

- “Whole platform Production-ready / fully GA”
- “Competition Engine Production GO”
- “Business Modules Production-ready percentage certified”
- “iOS/Android store released”
- “Live ecosystem integrations / webhooks active” (unless separately certified)
- “PITR enabled” / “full Storage recovery covered” / “latest schema recoverability verified”
- “Full Gate 1–10 historical packages present” / “traceability fully closed”
- “Monitoring/observability operationally verified”
- “Effective Production `VITE_RBAC_ENABLED` independently verified” (until Owner evidence)

## What requires separate rollout certification

- Competition Engine beyond local MVP
- Business Module GA (especially Club/Finance/CRM)
- Intelligence & Analytics Production
- Broader authenticated multi-tenant GA claims after env/RBAC confirmation
- Any new schema/RLS-sensitive change without considering drill 02

## What requires recovery or monitoring improvements

- PITR revisit (optional Owner cost)
- Storage object backup plan
- Restore drill 02 (schema + Clubs RLS recoverability)
- Monitoring/IR effectiveness SSOT PASS
- Backup failure alerting verification

## Marker

`PLATFORM_FINAL_AUDIT_01_GATE_10_PERMITTED_RELEASE_SCOPE_RECORDED`
