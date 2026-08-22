# Wave 2 Batch 2B — Owner Decisions (Foundations & Tokens)

**STATUS:** LOCKED by Owner GO  
**DATE:** 2026-08-22  
**PR:** #464

## Color

```
WORKSPACE_PRIMARY=BLUE_#3B82F6
SUCCESS=GREEN_#10B981
```

| Role | Hex | Intent |
|------|-----|--------|
| PRIMARY | `#3B82F6` | actions / selected / links / active / focus |
| SUCCESS | `#10B981` | success / healthy / complete |
| WARNING | `#D97706` | warning / attention |
| ERROR | `#DC2626` | destructive / failed / dangerous |
| INFO | `#3B82F6` | informational (same blue family; not a second brand) |
| NEUTRAL | `#64748B` | non-semantic / default |

**Do not describe green as primary after this Batch.**

```
PUBLIC_LIME_GLOBALIZED=NO  (#C5E831 stays PUBLIC_SHARED)
TOURNAMENT_PRIMARY_GLOBALIZED=NO  (#2563EB stays Tournament Experience)
```

## Typography

```
AUTH_FONT=INTER
AUTHENTICATED_CANONICAL_FONT=Inter
```

DM Sans remains loaded only for PublicLayout isolation + fallback stack.

```
PUBLIC_FONT_CHANGED=NO  (PublicLayout pins TYPOGRAPHY.publicFontFamily)
TOURNAMENT_FROZEN_TYPOGRAPHY_CHANGED=NO
```

## Architecture (unchanged)

```
CANONICAL_THEME=src/theme/theme.js
CANONICAL_TOKEN_SSOT=src/theme/designTokens.js
FIGURE1_SHELL_TOKENS=src/theme/figure1Tokens.js (FROZEN)
```
