# Tournament Experience — Design System (Phase 2A)

Isolated prototype tokens. Does **not** change the global PICK_VN theme.

## COLOR_TOKENS

| Token | Value | Use |
|---|---|---|
| primary | `#2563EB` | CTA, selected nav, tabs, links, focus, filters |
| primaryDark | `#1D4ED8` | hover/pressed |
| primaryLight | `#3B82F6` | same hue family (existing PICK_VN figure1 blue) |
| success | `#059669` | Ready / Valid / Completed |
| live / danger | `#DC2626` | LIVE / Error / Forfeit / Delete |
| warning | `#D97706` | Delay / Attention |
| purple | `#7C3AED` | Event/category accent only |
| grey | `#94A3B8` | Draft / Disabled / Neutral |
| navy | `#0F1B2D` | Operator sidebar |
| pageBg | `#F8FAFC` | Light workspace |
| cardBg | `#FFFFFF` | Cards |

BLUE = action. GREEN = success. RED = live/critical/delete. AMBER = warning. COMPLETE is **not** red.

## TYPOGRAPHY

Semantic levels in `TOURNAMENT_TYPE`: PAGE_TITLE, PAGE_SUBTITLE, TOURNAMENT_TITLE, EVENT_TITLE, SECTION_TITLE, CARD_TITLE, KPI_VALUE, KPI_LABEL, TABLE_HEADER, TABLE_BODY, BODY_PRIMARY, BODY_SECONDARY, STATUS_LABEL, HELPER_TEXT, BUTTON_LABEL.

Family: DM Sans / Inter (same as PICK_VN).

## SPACING

8-based: 4 / 8 / 12 / 16 / 24 / 32. Page 24 desktop, 16 tablet/mobile. Card pad 20, card gap 16.

## RADIUS

Control 10, card 12, pill 999.

## STATUS_SYSTEM

Always icon + label + color. Never color alone.

## BUTTON_HIERARCHY

PRIMARY blue · SECONDARY outlined · TERTIARY text · LOCK high-consequence + lock icon · PUBLISH primary · COMPLETE terminal (not red) · DELETE red.

## CARD / TABLE / NAV / RIGHT_RAIL / RESPONSIVE

See `tournamentDesignTokens.js`. Operator default = light workspace + dark navy nav. Draw Room dark is a **mode** of the same system (not implemented in Phase 2A).

## THEMES

- CANONICAL_OPERATOR_THEME = light + navy sidebar + Tournament Blue
- DRAW_PRESENTATION_THEME = dark surfaces, same tokens (deferred)
- PUBLIC_THEME_RELATIONSHIP = same brand/status/score language (deferred)
