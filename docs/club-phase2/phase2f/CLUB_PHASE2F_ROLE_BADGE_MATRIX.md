# Club Phase 2F — Role / Badge Matrix

## Canonical governance labels (frozen Phase 2E)

| Role | Label | Chip role |
|------|-------|-----------|
| Owner | Chủ sở hữu | `owner` |
| President | Chủ tịch | `president` |
| Vice President | Phó chủ tịch | `vice` |
| Owner+President | Chủ sở hữu & Chủ tịch | `president` (+ combined text) |

Membership (non-governance) labels from `CLUB_MEMBER_ROLE_LABELS`:

| Code | Label |
|------|-------|
| member | Thành viên |
| manager | Quản lý CLB |
| captain | Đội trưởng |
| coach | Huấn luyện viên |

## Checks

| Check | Result |
|-------|--------|
| Spelling/capitalization consistent with `GOVERNANCE_ROLE_LABELS` | PASS |
| No conflicting labels across Home / Org / Manage / Members | PASS (canonical) |
| Same role → same badge | PASS |
| Owner=President → single combined label (not two misleading badges) | PASS |
| VPs in governance area + member list | PASS |
| Badge does not grant authz | PASS (display only) |
| Raw enums never displayed (Manage Members fixed) | PASS |
| Raw UUIDs never as names (Manage + My Club) | PASS |

Note: STEP brief “Phó Chủ tịch” capitalization differs from frozen **Phó chủ tịch**; Phase 2E freeze wins.
