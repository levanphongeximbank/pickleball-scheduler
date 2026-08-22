# DELIVERY_WAVE_PLAN

**Workstream:** web-app-experience-master-closure-01  
**Mode:** PROPOSAL ONLY — do not implement.  
**Constraint:** Tournament Experience 23-screen Production Cutover stays frozen.  
**Constraint:** No new writers, no SQL, no Staging/Production mutation in UX waves unless a later Owner GO says otherwise.

Evidence supports the suggested 8-wave structure, with Wave 1 **required before** visual restyle so Production Canonical shell and V5 menu stop diverging.

```
PROPOSED_WAVE_COUNT=8
```

---

## WAVE 1 — App Shell + Navigation

**SCOPE=** Single chrome path: CanonicalAppShell as shared shell; retire dual IA (align V5 `MENU_GROUPS` / `ROLE_MENU_MAP` with Canonical registry). Fix P0-01 auth prefix for Experience organizer routes. Fix P1-01 messaging map, P1-02 support permissions vs menu, P1-03 cashier over-expose, P1-04 captain paths, P1-05/P1-07 **link adapters only** (create/hub/club → `/overview` for individual; do not delete setup). Restore Help on Canonical topbar → `/support` (or honest label). Refresh stale `canonicalRouteCatalog` to include Experience 23 routes.

**SCREENS=** Shell chrome (all authenticated); menu leaves; Experience entry points; `/messages`; `/support`; cashier leaves; captain zone; tournament create landing.

**DEPENDENCIES=** Owner confirms Production flag remains ON. Auth owner for P0-01. Do not restyle Experience internals.

**RISK=** Menu hide/show can 403 or hide live features. Adapter mistakes could send team/daily to individual overview. Rollback = flag OFF still exists — do not remove legacy shell in Wave 1.

**EXPECTED_OWNER_REVIEW=** GO on: (a) CanonicalAppShell is the one chrome; (b) Experience organizer permission model; (c) which `/tournament/*` hubs remain in sidebar during strangler.

---

## WAVE 2 — Shared Design System

**SCOPE=** Web App token layer: workspace primary Figure 1 `#3B82F6`, success `#10B981`, font Inter (Batch 2B Owner lock). Shared PageHeader / Empty / Loading / Error / Table / Dialog in later batches. Do **not** retokenize frozen Experience files. Deduplicate chips outside Experience.

**SCREENS=** Token consumers: Dashboard, Players, Court, Club, Finance, Billing, Admin (pilot 1–2 modules first).

**DEPENDENCIES=** Wave 1 shell stable so tokens apply to one chrome.

**RISK=** Global theme swap can regress Production shell. Keep Experience tokens isolated.

**EXPECTED_OWNER_REVIEW=** ~~GO on primary color~~ **LOCKED 2B:** Primary `#3B82F6`, Success `#10B981`, Font Inter.

---

## WAVE 3 — Core high-traffic modules

**SCOPE=** Apply Wave 2 primitives (not a redesign from scratch) to: Dashboard, Court calendar/bookings, Players, Tournament **list/create** (entry only), Notifications. Calendar overflow (P1-09) as UX/CSS, not a new calendar product.

**SCREENS=** `/dashboard`, `/court-management/calendar`, `/court-management/bookings`, `/players`, `/tournament/list`, `/tournament/create`, `/notifications`.

**DEPENDENCIES=** Wave 2 tokens. Wave 1 adapters so list/create continue into Experience.

**RISK=** Calendar is operationally critical. Touch/table work must not break booking writers.

**EXPECTED_OWNER_REVIEW=** Visual parity sample vs Experience language; calendar still operable at 768/430.

---

## WAVE 4 — Remaining business modules

**SCOPE=** Club (`/manage/clubs` family), Coaching (dedupe lists), Finance ledger, Billing **Vietnamese copy**, CRM PARTIAL honesty, Messaging shell visual alignment (keep OD-B01 separate), AI hub, Support guide (remove env flag names), Admin tables.

**SCREENS=** Club/coaching/finance/billing/crm/messages/ai/support/admin suite.

**DEPENDENCIES=** Wave 2. Do not merge `/messages` into `/crm/messages`.

**RISK=** Billing EN→VN is copy-only. Finance staging runtime stays. Admin ID columns may remain for technicians with VN labels.

**EXPECTED_OWNER_REVIEW=** GO on club dual surface (`/club` retire timing) and coaching list winner path.

---

## WAVE 5 — Legacy convergence

**SCOPE=** Strangler for **individual** Internal/Official setup UIs and global tournament hubs via **adapters** (no runtime rewrite). Keep Team, Daily Play, Director Mode, Engine, referee token as documented extensions. Update catalog. Do not delete routes in this wave unless Owner GO.

**SCREENS=** `/tournament/internal/:id`, `/tournament/official/:id`, hubs, `/tournaments/:id`, engine **entries**, Director **entries**, club history links.

**DEPENDENCIES=** Wave 1 adapters proven. Domain owners for team/daily (out of this wave except mapping).

**RISK=** Highest domain risk. Wrong redirect breaks live tournaments. Prefer additive “Open in Experience” before hiding setup.

**EXPECTED_OWNER_REVIEW=** GO per family: Internal, Official, Team (extension), Daily (extension), Engine/Director keep.

---

## WAVE 6 — Responsive / mobile web

**SCOPE=** Viewport matrix 1920/1440/1024/768/430/390/360 on Wave 3–4 screens + Experience (regression only — no Experience redesign). Unify breakpoint (`useIsMobile` vs Figure 1 899). Topbar switcher wrap. Dialog `fullScreen` on xs. Touch 44px. Bottom nav overflow.

**SCREENS=** Calendar, tournament list, Experience overview (regression), finance, admin, login, public home, referee token.

**DEPENDENCIES=** Waves 2–4 so we do not polish throwaway layouts.

**RISK=** Experience regression. Treat Experience as freeze + bugfix only.

**EXPECTED_OWNER_REVIEW=** Device QA checklist sign-off; no visual redesign of 23 screens.

---

## WAVE 7 — Public surfaces

**SCOPE=** PublicLayout alignment to Web App language without copying admin shell. Catalog 404s vs real club/court public detail (product decision). Public tournaments deep-link to Experience public. Rankings/news.

**SCREENS=** `/`, `/home`, `/public/tournaments`, `/clubs`, `/courts`, `/rankings`, `/news`, Experience `/public`.

**DEPENDENCIES=** Wave 2 tokens. Experience public stays frozen (visual tweak only if Owner GO).

**RISK=** SEO/marketing. Do not put MainLayout on public routes.

**EXPECTED_OWNER_REVIEW=** GO on whether public club/court `:id` stays 404 or becomes a real page.

---

## WAVE 8 — Final Production audit

**SCOPE=** Re-run this inventory: routes, menus, roles, a11y, responsive, language. Confirm P0-01 closed. Confirm Experience freeze intact. Confirm no new writers/SQL from UX program. Production flag + rollback still documented.

**SCREENS=** Full matrix sample, not every route.

**DEPENDENCIES=** Waves 1–7 closed or explicitly deferred with Owner list.

**RISK=** Treat remaining P3/P4 as defer, not silent pass.

**EXPECTED_OWNER_REVIEW=** WEB_APP_EXPERIENCE_PRODUCTION_CLOSURE GO / NO-GO.

---

## Wave graph

```
W1 Shell+Nav+Auth adapters
        ↓
W2 Design system (tokens/primitives)
        ↓
   ┌────┴────┐
W3 High-traffic   W5 Legacy adapters (can start after W1; safer after W3 list/create)
   └────┬────┘
        ↓
W4 Remaining modules
        ↓
W6 Responsive
        ↓
W7 Public
        ↓
W8 Final audit
```

Team/Daily Experience **extensions** are a **separate Owner program**, not Wave 5 deletion.
