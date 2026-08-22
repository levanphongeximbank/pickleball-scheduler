# WAVE 2 DELIVERY PLAN — Shared Design System

**MODE:** PROPOSAL ONLY — Batch 2A does not implement.  
**Constraint:** No mass migration of ~186 screens. Waves 3–5 own module adoption.  
**Constraint:** Tournament Experience 23 + Public Web + Wave 1 shell remain frozen.

```
PROPOSED_WAVE2_BATCH_COUNT=6
PROPOSED_DESIGN_SYSTEM_LAYERS=0..4
```

---

## Layer architecture

```
Layer 0  Foundations     designTokens + theme.js     [2B]
Layer 1  Primitives      MUI + StatusToneChip        [2C]
Layer 2  Shared patterns PageHeader, Table, Empty…   [2D]
Layer 3  Domain          court/club/finance/CRM…     [Waves 3–5]
Layer 4  Pages           route implementations       [Waves 3–5, 2E pilots]
```

---

## Batches

### 2A — Master Audit (this)

Docs only under `docs/v5/web-app-experience/wave2/`.

### 2B — Foundations & Tokens

**In:** Extend `designTokens.js` semantic roles (info, surfaceElevated, disabled, focusRing workspace, live optional). Point `theme.js` hardcoded greys at tokens. Optional: Card radius 12 on **base** theme if Owner GO. Add `LAYOUT.contentPaddingMobile: 16`.  
**Out:** No nested extra ThemeProvider. No Figure 1 token rewrite. No Experience token merge. No public lime promotion. No breakpoint change.

**Rollback:** revert two files (`designTokens.js`, `theme.js`).

**Tests:** snapshot/freeze token JSON or exported constants; Wave 1 `FIGURE1_BREAKPOINTS` tests still pass unchanged.

### 2C — Shared Primitives

**In:** `theme.js` Button focus-visible, destructive recipe, loading helper. `StatusToneChip` (Slate colors). `FieldError` helper.  
**Out:** New Button package. Changing ExperienceStatusChip. Icon library swap.

**Rollback:** revert theme overrides; delete new files if added under an authenticated shared folder (path chosen in 2C, e.g. `src/features/web-app-ui/` — **do not** invent a second theme).

### 2D — Shared Patterns

**In:** AuthPageHeader (from ClubPageShell), AuthConfirmDialog (from ClubConfirmDialog), AuthEmpty/Loading/Error, AuthResponsiveTable (from ResponsiveDataView), FilterBar, AppSnackbar.  
**Out:** Rewriting Club internals except re-export adapters. Calendar rewrite. DataGrid rollout.

### 2E — Representative pilot (not 186 screens)

Proposed pilots (authenticated only):

| Screen | Why |
|--------|-----|
| Dashboard | StatCard vs KpiCard; empty/loading |
| Players | Remove TournamentPageHeader/Empty leak |
| AuditLogPage | Table wrapper; **do not claim W6-PAGE-002 closed** |
| Support guide | Simplest PageHeader adoption |
| Optional: one Court **list** (not calendar matrix) | Filter + table |

**Out:** Experience 23, public `/`, finance writers, CRM semantics.

### 2F — Regression / certification

- Wave 1 shell exclusivity + breakpoint tests green  
- Token lock  
- Primitive a11y (ConfirmDialog keyboard, FieldError)  
- Pilot screens smoke  
- No Storybook unless Owner GO (**do not add in 2A–2E by default**)

```
COMPONENT_EXPLORER_CURRENT=NONE
VISUAL_REGRESSION_CURRENT=NONE
DESIGN_SYSTEM_TEST_GAPS=token lock, primitive a11y, visual snapshots, explorer
```

---

## Migration strategy (strangler)

For each canonical:

| Field | Pattern |
|-------|---------|
| NEW_CANONICAL | Prefer **adapt file in place** (theme/tokens) or **thin extract** next to existing Club/mobile component with re-export so Club keep working |
| EXISTING_COMPONENT_TO_ADAPT | Listed in GAP matrix |
| LEGACY_COMPONENTS | Remain until page adoption |
| ADOPTION_APPROACH | New code + touched pilots import Layer 2; no codemod repo-wide |
| DELETE_WHEN | After Waves 3–5 reduce call sites to zero **and** Owner GO |
| ROLLBACK | Feature flag unnecessary if 2B/2C are theme-only; 2D extracts must re-export old names |

---

## Test strategy (future)

| Kind | Proposal |
|------|----------|
| unit | Token exports frozen; StatusToneChip tone map |
| component | PageHeader, ConfirmDialog, Empty, ResponsiveTable |
| visual | Optional later Playwright screenshots of pilots at 1440/1024/430 — **none today** |
| responsive | Reuse Wave 1 899/1200 locks; W6-PAGE-002 remains open |
| a11y | ConfirmDialog + FieldError + keep shell a11y tests |
| regression | Wave 1 batch tests + 2E page smoke |
| foundation lock | `FIGURE1_BREAKPOINTS` import tests must not change values |

Playwright is already a devDependency for QA/shell — not a DS visual system.

---

## Waves 3–5 adoption contract

1. Import Layer 0–2 only for **new or touched** authenticated screens.  
2. Do not import Experience visual files into Club/Finance/Admin.  
3. Do not import Public lime/glass into auth.  
4. Domain chips wrap StatusToneChip; they keep domain enums.  
5. Calendar, referee, draw-room stay domain/frozen.  
6. Broad restyle of remaining modules is Wave 3–4, not Wave 2.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Global theme swap regresses Production shell | 2B does not change Figure 1 tokens; nested shell theme stays |
| Card radius 12 vs 16 flicker | Owner GO; if yes, change base theme so nested override becomes no-op |
| Promoting Experience blue accidentally | StatusToneChip uses Slate; info tone uses secondary/slate not `#2563EB` unless GO |
| Scope creep to 186 screens | 2E cap list; STOP after 2F |

```
NEXT_BATCH=OWNER_REVIEW_THEN_2B_FOUNDATIONS_TOKENS
IMPLEMENTATION_STARTED=NO
STOP_NOW=YES
```
