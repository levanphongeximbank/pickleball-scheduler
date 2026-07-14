# PR-5 — SUPER_ADMIN Private Pairing Rules UI

## Worktree

`C:/Users/Le Phong/pickleball-scheduler-pr45-private-pairing`  
Branch: `feature/private-pairing-rules-v2`

## Route / menu

| Item | Value |
|------|--------|
| Route | `/admin/ai-pairing/private-rules` |
| Page | `src/pages/admin/PrivatePairingRulesAdminPage.jsx` |
| Menu | Quản trị → **Quy tắc ghép cặp riêng** (flat leaf; sidebar max folder depth = 0) |
| Guard | `SuperAdminRouteGuard` + `SuperAdminFeatureGate` + `ROUTE_PERMISSIONS` + menu `requiresFeature` |

Feature: `VITE_PRIVATE_PAIRING_RULES_ENABLED` (menu hidden via `requiresFeature: privatePairingRules`).

## Permissions

- `pairing.private_rules.view`
- `pairing.private_rules.manage`
- `pairing.private_rules.audit`
- `pairing.private_rules.simulate`

Helpers: `ui/privatePairingPermissions.js`

## Architecture

```
PrivatePairingRulesAdminPage
  → PrivatePairingRulesAdminView
      → PrivatePairingRuleSetList
      → PrivatePairingConflictPanel
      → PrivatePairingVersionHistory
      → PrivatePairingSimulationPanel → PrivatePairingCandidateCard
      → PrivatePairingAuditLog
```

Simulation uses PR-4.5 `simulatePrivatePairing` (read-only). **No Apply-to-live.**

## Canonical pickers

Club/player selectors use `privatePairingPlayerPickerAdapter` → canonical repositories when flags ON. Picker values are `playerId`.

## Rollback

Keep flags OFF. Revert PR-5 commits. No DB.

## Known limitations

- Sidebar convention cannot nest “AI & Ghép cặp” folder (depth 0); leaf note documents group.
- Full visual screenshot set recorded as local evidence checklist (Preview optional).
- Rule dialog still hosted in AdminView (form helpers exported via `PrivatePairingRuleForm.jsx`).
