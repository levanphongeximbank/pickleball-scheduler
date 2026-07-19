# Club Phase 2G — Governance Display Checklist

Legend: **CODE_PASS** = Phase 2F automation + source re-inspection on `f6ae0ee`. **LIVE** = authenticated browser (blocked).

| # | Check | Expected | Method | Result |
|---|-------|----------|--------|--------|
| G1 | Owner label | `Chủ sở hữu` (VN) | Unit + source | **CODE_PASS** |
| G2 | President label | `Chủ tịch` | Unit + source | **CODE_PASS** |
| G3 | VP 0 / 1 / 2 slots | Empty `—` / one / two | Phase 2F test 11 | **CODE_PASS** |
| G4 | Owner = President | Combined `Chủ sở hữu & Chủ tịch`; unique officer count 1 | Phase 2F tests 9, 17–18 | **CODE_PASS** |
| G5 | Role badges | Canonical chips; no raw enums | Phase 2F tests 7, 16–17 | **CODE_PASS** |
| G6 | Member totals (Home / Org) | Cloud `activeMemberCount` path; officers not inflating | Phase 2F test 18 + member-count doc | **CODE_PASS** |
| G7 | No raw enums on Manage Members | No `governanceRoles.join` | Phase 2F test 7 | **CODE_PASS** |
| G8 | No UUID as member display name | Missing → `Chưa có thông tin` / `VĐV` | Phase 2F tests 12, 26 | **CODE_PASS** |
| G9 | No duplicate officer count | `countUniqueActiveGovernancePersons` | Phase 2F tests 9, 18 | **CODE_PASS** |
| G10 | Canonical hooks on Home / Gov / Org / Manage | `useGovernanceReadModel` | Phase 2F tests 2–5 | **CODE_PASS** |
| G11 | Live layout Owner≠President | Distinct rows/cards | Live | **BLOCKED** |
| G12 | Live layout Owner=President | Combined presentation acceptable | Live | **BLOCKED** |
| G13 | Live VP wrapping | No clip/overflow | Live | **BLOCKED** |

## Notes

- Manage/My Club governance text **suppresses** a second President row when `combinedOwnerPresident` is true.
- Org Chart / Home Summary still show **both** Owner and President *role slots* when combined (Owner value carries combined label; President value strips parenthetical). This is role-slot UX, not double officer counting.
- UUID still appears as **secondary** text in `GovernanceMemberSelect` (management selects) — see remaining risks.
