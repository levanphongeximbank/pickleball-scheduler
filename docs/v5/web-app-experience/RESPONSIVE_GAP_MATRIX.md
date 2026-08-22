# RESPONSIVE_GAP_MATRIX

**Workstream:** web-app-experience-master-closure-01  
**Mode:** AUDIT_ONLY — inferred from code (MUI breakpoints + `sx`), not live browser.  
**Breakpoints in play:** MUI `xs/sm/md/lg/xl` **and** Figure 1 `mobileMax 899 / tablet 900–1199 / desktop 1200`. Two breakpoint systems.

Shell: `useIsMobile` + `MainLayout` `pb: { xs: 9 }` for bottom nav. Canonical sidebar hidden below Figure 1 mobile max.

Legend: OK / RISK / CRITICAL.

---

## Representative screens

| Screen | 1920 | 1440 | 1024 | 768 | 430 | 390 | 360 |
|--------|------|------|------|-----|-----|-----|-----|
| Login | OK | OK | OK | OK | OK | OK | OK |
| Public home | OK | OK | OK | OK | OK | OK | OK |
| Dashboard | OK | OK | OK | OK | RISK tables | RISK | RISK |
| Court calendar | OK | OK | **CRITICAL** week `minWidth: 900` | CRITICAL overflow | CRITICAL | CRITICAL | CRITICAL |
| Court bookings table | OK | OK | RISK overflowX | RISK | RISK | RISK | RISK |
| Players grid | OK | OK | OK | OK | OK | OK | OK |
| Tournament list | OK | OK | RISK sticky actions | RISK icon-only | CRITICAL small IconButtons | CRITICAL | CRITICAL |
| Experience Center `/tournament` | OK | OK | OK | RISK secondary CTA hidden | RISK | RISK | RISK |
| Experience overview | OK | OK | OK | OK primary full-width | RISK rail stack | RISK | RISK |
| Experience draw rooms | OK | OK | RISK | RISK | RISK (dense board) | RISK | RISK |
| Experience public | OK | OK | OK | OK | OK | OK | OK |
| Director Mode | OK | OK | RISK dense | CRITICAL | CRITICAL | CRITICAL | CRITICAL |
| Tournament Engine tabs | OK | OK | RISK tables | CRITICAL | CRITICAL | CRITICAL | CRITICAL |
| Team setup `/tournament/team/:id` | OK | OK | RISK | RISK | RISK | RISK | RISK |
| Finance debt/receipts | OK | OK | RISK overflowX auto | RISK | RISK | RISK | RISK |
| Billing | OK | OK | OK | OK | OK | OK | OK |
| Messaging 2/3 pane | OK | OK | RISK | Stack | Stack | Stack | Stack |
| Club list | OK | OK | OK | OK | OK | OK | OK |
| Coaching schedule | OK | OK | RISK | RISK | RISK | RISK | RISK |
| Admin tables | OK | OK | RISK | RISK | CRITICAL | CRITICAL | CRITICAL |
| Referee token scoreboard | n/a | n/a | OK | OK | OK (designed mobile) | OK | OK |
| Canonical sidebar | OK | OK | Collapsed/drawer at &lt;900 | Drawer | Drawer | Drawer | Drawer |
| Legacy sidebar | OK | OK | Hidden on `useIsMobile` | Drawer | Drawer | Drawer | Drawer |
| Mobile bottom nav | hidden | hidden | depends `useIsMobile` | shown | shown | shown | **RISK** 5 items overflow |
| Canonical topbar switchers | OK | OK | RISK minWidths | RISK overflow hidden | CRITICAL clipped org/club | CRITICAL | CRITICAL |
| Dialogs (most) | OK | OK | OK | OK | RISK not fullScreen | RISK | RISK |
| Media presentation dialog | OK | OK | OK | fullScreen-ish | OK | OK | OK |

---

## Issue types observed (code)

| Issue | Where |
|-------|--------|
| Horizontal overflow | `CourtCalendarWeekMatrix` `minWidth: 900`; day grid `courts.length * 150`; finance tables; engine tables |
| Clipped text | CanonicalTopBar `overflow: hidden` + switcher minWidths |
| Hidden primary actions | Experience headers hide some secondary below `sm`; tournament list shrinks to icon-only |
| Tables unusable on mobile | Engine, finance, admin, tournament list (limited `ResponsiveDataView`) |
| Sidebar collapse | Two implementations; Figure 1 vs `useIsMobile` may disagree near 900px |
| Dialogs wider than viewport | Many Dialogs without `fullScreen` on `xs` |
| Sticky covering content | Bottom nav `pb: 9`; banners (subscription/offline) stack |
| Touch targets &lt;40px | Widespread `IconButton size="small"` (Figure 1 docs want 44) |
| Navigation overflow | MobileBottomNav 5+ items; V5 drawer long nested trees |

---

## RESPONSIVE_CRITICAL_GAPS (count for final report)

1. Court calendar week matrix overflow ≤1024  
2. Tournament list / engine / director unusable as tables on 360–430  
3. Canonical topbar context switchers clip on 360–430  
4. Dual breakpoint systems (MUI vs Figure 1) around 900px  
5. Touch targets on high-traffic list actions  

```
RESPONSIVE_CRITICAL_GAPS=5
```

Live device QA is **Wave 6**, not this static audit.
