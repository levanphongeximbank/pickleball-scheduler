# Authenticated Design System — Adoption Contract (Waves 3–5)

**STATUS:** LOCKED  
**WAVE:** Wave 2 — Shared Design System  
**AUTHORITY:** Authenticated workspace only (not Public Web, not Tournament Experience 23)

## Canonical stack

| Layer | Authority | Location |
|-------|-----------|----------|
| Foundations | Theme + token SSoT | `src/theme/theme.js`, `src/theme/designTokens.js` |
| Layer 1 | Shared primitives | `src/features/web-app-ui/` (`StatusToneChip`, `FieldError`, button/IconButton contracts) |
| Layer 2 | Shared patterns | `src/features/web-app-ui/` (`AuthPageHeader`, `AuthConfirmDialog`, `AuthEmptyState`, `AuthLoadingState`, `AuthErrorState`, `AuthResponsiveDataView`, `AuthFilterBar`, `AppSnackbar`) |

**AUTH_PRIMARY=`#3B82F6` · AUTH_SUCCESS=`#10B981` · AUTH_FONT=`Inter`**  
Figure 1 shell tokens remain a **frozen overlay**, not a second workspace authority.

## Rules for new / touched authenticated business pages

1. Use the canonical theme/tokens (`designTokens.js` → `theme.js`). Do not invent parallel color/spacing/breakpoint systems.
2. Prefer MUI Layer 1 primitives via the canonical theme; use `web-app-ui` Layer 1 helpers for button semantics, IconButton a11y, status tone, and field error.
3. Use `web-app-ui` Layer 2 shared patterns where page semantics match (header, confirm, empty/loading/error, filter bar, responsive data, snackbar).
4. Keep domain composition domain-owned (data hooks, permissions, mutations, status enums stay in the feature/page).
5. Do **not** import Tournament Experience or Public Web UI merely for convenience.
6. Preserve domain / status / authority semantics — shared UI must remain domain-neutral.
7. Migrate via **strangler adoption** (page-by-page), not a repo-wide rewrite.

## Explicit non-goals

- Mass migration of all authenticated screens in Wave 2 (Waves 3–5 own broad adoption).
- Storybook / component explorer (deferred to a future tooling workstream).
- Changing RLS, SQL, authorization, or backend authority.
- Redesigning Wave 1 shell chrome or Public/Tournament visual systems.

## Exit criteria for Waves 3–5 page PRs

- Consumes canonical theme/tokens.
- No new parallel design-system package.
- No Tournament/Public UI leak on authenticated business surfaces.
- Permissions, routes, and mutation semantics unchanged unless the product batch explicitly owns that change.
- Responsive: no new page-level horizontal overflow at Wave 1 breakpoints (Desktop ≥1200, Tablet 900–1199, Mobile ≤899).

```
WAVES_3_TO_5_ADOPTION_CONTRACT=LOCKED
CANONICAL_SHARED_DESIGN_SYSTEM_READY_FOR_ADOPTION=YES
```
