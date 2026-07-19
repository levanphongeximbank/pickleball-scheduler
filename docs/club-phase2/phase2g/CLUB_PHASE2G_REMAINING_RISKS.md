# Club Phase 2G — Remaining Risks

| ID | Severity | Area | Detail | Blocks 2G automated closure? |
|----|----------|------|--------|------------------------------|
| FU-2G-1 | MEDIUM (process) | Visual / console | Authenticated Production/Preview smoke + screenshots + console still unverified | No (noted) |
| FU-2G-2 | LOW | Management select | `GovernanceMemberSelect` shows full `userId` as MenuItem **secondary** | No |
| FU-2G-3 | LOW | Candidate names | Governance candidate fallback may use `User ${uuid.slice(0,8)}` before hydration | No |
| FU-2G-4 | MEDIUM | Manage Overview stats | `ClubOverviewTab` member/ELO cards still use local `getClubStats` under V2 (governance panel itself is canonical) | No for governance labels |
| FU-2G-5 | LOW | Responsive | Manage `ClubGovernancePanel` name rows lack `wordBreak`; some confirm dialogs lack `fullWidth` | No |
| FU-2G-6 | LOW | A11y | Some IconButtons Tooltip-only; member-list errors without retry action | No |
| FU-2G-7 | INFO | Dual role slots | Home/Org still render Owner + President slots when combined (count uniqueness OK) | No |
| FU-2F-2 | INFO | Discover OFF | Discover V2 OFF may still use `fetchGovernanceNameHints` (accepted in 2F) | No |
| FU-2F-3 | INFO | List RPC | Registry/list president labels remain parallel SoT for list UIs | No |

## Explicitly out of this charter

- Roadmap **legacy retirement 2G** (writers / blob allow-list)  
- Phase **2H** final Production certification (Owner GO)  
- Boundary cutovers (historical roadmap “2F”)  
- Production SQL / deploy  

## Defect policy this run

No live-confirmed UI defect required a production code change. Residual items above are **follow-ups**, not Phase 2G blockers for the automated + Production-deploy certification path.
