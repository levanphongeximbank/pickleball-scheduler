# FORM CONTROL MATRIX — Wave 2 Batch 2A

**MODE:** AUDIT_ONLY

```
FORM_CONTROL_PATTERN_COUNT=7
CUSTOM_FORM_CONTROL_COUNT=5
FORM_SEMANTIC_GAPS=6
```

No `@mui/x-date-pickers` usage. Dates are native HTML inputs.

---

## 1. Patterns

| # | Pattern | How used | Canonical? |
|---|---------|----------|------------|
| 1 | MUI TextField | Theme `defaultProps.size="small"`; outlined radius 10; focus primary green | **KEEP** |
| 2 | MUI Select / MenuItem | Often inside TextField `select` | KEEP |
| 3 | MUI Autocomplete | ~14 files (CanonicalGlobalSearch, GlobalSearch, club forms, referee assign, cluster admin, pairing, facility claim) | KEEP; density varies |
| 4 | Checkbox / Radio / Switch | Raw MUI | KEEP |
| 5 | Native `type="date"` / `time` / `datetime-local` | Court booking, finance due date, CRM campaigns, tournament fees, player profile, pairing admin | FEATURE pattern — no DatePicker primitive |
| 6 | Slider | Players skill form | DOMAIN |
| 7 | MUI Form labels via TextField `label` / `helperText` | Inconsistent required marker (`*` vs none) | ADAPT in 2C FieldError |

---

## 2. Custom controls (`CUSTOM_FORM_CONTROL_COUNT=5`)

| Control | File | ACTION |
|---------|------|--------|
| TournamentLevelSelect | tournament feature | FEATURE_SPECIFIC_KEEP |
| GovernanceMemberSelect | club/governance | FEATURE_SPECIFIC_KEEP |
| AvatarPicker | `src/features/identity/components/AvatarPicker.jsx` | FEATURE_SPECIFIC_KEEP |
| CaptainAccessToggle | `CaptainAccessToggle.jsx` | FEATURE_SPECIFIC_KEEP |
| PrivatePairingRuleForm | private-pairing-rules | FEATURE_SPECIFIC_KEEP |

---

## 3. Consistency audit

| Concern | Finding |
|---------|---------|
| Label | Mix of `label` prop vs sibling Typography |
| Required marker | Not standardized; some Dialogs omit `required` |
| Error | `error` + `helperText` on some TextFields; many submit-time Alerts instead |
| Helper text | Inconsistent Vietnamese |
| Disabled / read-only | Ad-hoc; no shared read-only field recipe |
| Loading | Fields stay enabled while page Alert shows “Đang tải” |
| Placeholder | Mix EN/VN |
| Vietnamese copy | Club/finance/CRM generally VN; some admin/billing still EN |

**FORM_SEMANTIC_GAPS:**

1. No FieldError / required marker contract.  
2. Native date inputs unstyled vs TextField density; locale `vi-VN` not guaranteed.  
3. Autocomplete vs Select chosen per page without rule.  
4. No shared search/filter bar (Select stacks).  
5. Validation is page-local Alerts, not field-level.  
6. `aria-invalid` / `aria-describedby` sparse.

---

## 4. Adoption (later)

| Field | Value |
|-------|-------|
| NEW_CANONICAL | Theme defaults + optional `FieldError` helper; **not** a new form library |
| EXISTING_COMPONENT_TO_ADAPT | MUI TextField/Select in `theme.js`; Club forms as density reference |
| LEGACY_COMPONENTS | HTML date inputs stay until a later Owner GO on DatePicker |
| ADOPTION_APPROACH | 2C theme + FieldError; 2D FilterBar; pilots in 2E |
| DELETE_WHEN | n/a |
| ROLLBACK | Revert theme TextField defaults |
