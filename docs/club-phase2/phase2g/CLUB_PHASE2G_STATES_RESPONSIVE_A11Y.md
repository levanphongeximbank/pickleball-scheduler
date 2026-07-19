# Club Phase 2G — States · Responsive · Accessibility

## States (code / unit)

| State | Surfaces wired | Result |
|-------|----------------|--------|
| Loading | Home, Org Chart, My Club Gov, Manage Gov, Members lists, Club list | **CODE_PASS** |
| Error + retry (`Thử lại`) | Home, Org, My Club Gov, Manage Gov, Club list | **CODE_PASS** |
| Empty | Members empty states; unassigned officer labels | **CODE_PASS** |
| Missing profile | `GOVERNANCE_MISSING_PROFILE_LABEL` (`Chưa có thông tin`) | **CODE_PASS** |
| Inactive / left / removed officer ref | `stale_reference` in read model | **CODE_PASS** |
| Members list error retry button | Warning text only on some member panels | **NOTE** (no action button) |

Live confirmation of each state: **BLOCKED**.

## Responsive (source contracts)

| Check | Desktop | Tablet | Mobile | Live pixels |
|-------|---------|--------|--------|-------------|
| Org / My Club Gov `wordBreak: break-word` | Yes | Yes | Yes | BLOCKED |
| Badge `flexWrap` on Members | Yes | Yes | Yes | BLOCKED |
| Members / schedule `md` breakpoint | Yes | Yes | Yes | BLOCKED |
| Transfer dialogs `fullWidth` `maxWidth=sm` | Yes | Yes | Yes | BLOCKED |
| Manage Gov names `wordBreak` | Missing on `ClubGovernancePanel` typography | — | — | **NOTE** |
| Delete/remove confirm dialogs `fullWidth` | Partial gaps | — | — | **NOTE** |

## Accessibility (source contracts)

| Check | Result |
|-------|--------|
| Visible VN labels on governance roles | **CODE_PASS** |
| Chip `aria-label` on role / status (where present) | **CODE_PASS** |
| Status not color-only (Chip text) | **CODE_PASS** |
| Org loading `aria-label` | **CODE_PASS** |
| Keyboard via MUI Button/Select/Dialog | **CODE_PASS** (structural) |
| Some IconButtons rely on Tooltip only | **NOTE** |
| Authenticated keyboard / screen-reader pass | **BLOCKED** |

## Browser console

| Check | Result |
|-------|--------|
| Uncaught errors on governance pages | **NOT_RUN** (auth blocked) |
| Repeated warnings from governance UI | **NOT_RUN** (auth blocked) |
