# Accessibility Priority Matrix

`WAVE3_A11Y_CRITICAL_GAPS=0`
`WAVE3_A11Y_MAJOR_GAPS=9`
`WAVE3_A11Y_MINOR_GAPS=7`

## Major

1. Booking/customer/member/coaching tables lack a consistent accessible name/caption and scoped headers.
2. Desktop-only tables do not provide labeled mobile field/value composition.
3. Coaching deletion uses native `window.confirm`, outside the canonical dialog/focus contract.
4. Check-in synchronization uses `window.alert`, outside the canonical feedback/live-region contract.
5. Customer/member clickable table rows do not expose equivalent keyboard row activation semantics.
6. Several filters use placeholder-only search text instead of a persistent label.
7. Form validation Alerts are not consistently associated with invalid fields through `aria-describedby`.
8. Status meaning is sometimes conveyed primarily by chip/text color without a shared explicit accessible label.
9. Page heading levels are inconsistent in court, check-in, coaching, and rating surfaces.

## Minor

1. Dense table icon actions can be below the 44px touch target.
2. Filter clear/result count announcement is inconsistent.
3. Snackbar/Alert politeness differs across modules.
4. Long filter groups lack grouping labels.
5. Horizontal table regions do not consistently identify themselves to screen-reader users.
6. Loading indicators repeat visible text in table bodies and banners.
7. Focus return after closing domain form/detail dialogs is not uniformly tested.

## Positive locks

- Canonical shared controls provide focus-visible treatment.
- `AuthPageHeader` supplies an `h1`.
- `AuthConfirmDialog` provides dialog labeling/focus behavior.
- Existing coaching icon buttons have accessible names.
- Club empty state already uses `role="status"`.

No critical blocker was found by static source audit. Batch implementation must add component-level keyboard/name/state tests; final certification requires route smoke plus manual 390/430 touch and screen-reader spot checks.
