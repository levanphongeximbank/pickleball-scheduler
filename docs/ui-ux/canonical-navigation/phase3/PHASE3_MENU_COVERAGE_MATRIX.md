# Phase 3 Menu Coverage Matrix

## Summary

| Metric | Count |
|--------|------:|
| Inventoried routes (catalog) | 179 |
| Proposed canonical menu leaves | 82 |
| Active general menu surface leaves | 75 |
| Contextual parameterized (hidden from general menu/search) | 7 |
| Level-1 groups | 13 |
| Level-2 modules | 53 |
| Level-3 actions (registry) | 82 |
| PARTIAL badge nodes | 6 |
| Legacy hidden (classification) | 48 |
| Shadow hidden | 1 |
| Duplicate active entries | 0 |

## Classification handling

| Classification | Count | Menu/search |
|----------------|------:|-------------|
| CANONICAL | 89 | Proposed subset only |
| HIDDEN_ACTIVE | 40 | Not in general menu |
| LEGACY | 48 | Hidden; redirect metadata later (Phase 4) |
| DUPLICATE | 1 | Not dual-listed |
| SHADOW | 1 | Hidden (B03) |

## Level-1 groups (13)

1. Tổng quan  
2. Vận hành sân  
3. Khách hàng & VĐV  
4. CLB & Huấn luyện  
5. Giải đấu  
6. Rating & Xếp hạng  
7. Tài chính  
8. Báo cáo & Phân tích  
9. AI Assistant  
10. Thông báo  
11. Public Portal  
12. Quản trị nền tảng  
13. Hỗ trợ  

## PARTIAL (honest non-GA)

- `/reports`
- `/crm/messages`
- `/crm/templates`
- `/crm/campaigns`
- `/crm/history`
- `/crm/reminders/booking`

## Contextual parameterized (B02 family)

Remain in registry for active-match + breadcrumbs; excluded from general menu/search:

- `/tournaments/:tournamentId/engine`
- `/tournaments/:tournamentId/seed`
- `/tournaments/:tournamentId/draw`
- `/tournaments/:tournamentId/schedule`
- `/tournaments/:tournamentId/courts`
- `/tournaments/:tournamentId/ranking`
- `/tournaments/:tournamentId/logs`

## Single registry consumers

| Surface | Source |
|---------|--------|
| Desktop sidebar | `filterCanonicalMenu` ← `buildCanonicalMenuTree` |
| Mobile drawer | same |
| Breadcrumbs | full registry + auth-safe labels |
| Global search | `buildCanonicalSearchIndex` |
| Active-route matching | `findActiveCanonicalNode` / `isCanonicalRouteActive` |
