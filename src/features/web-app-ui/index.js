/**
 * Authenticated shared Layer 1 + Layer 2 (Wave 2 Batch 2C / 2D).
 *
 * Ownership: AUTHENTICATED_SHARED
 * Location: src/features/web-app-ui/
 *
 * Not a parallel design-system package — thin semantic helpers + shared patterns
 * on top of MUI + src/theme.
 */

/* —— Layer 1 primitives (Batch 2C) —— */
export {
  BUTTON_LOADING_STRATEGY,
  BUTTON_SEMANTICS,
  buttonLoadingProps,
  sharedTouchTargetSx,
} from "./buttonSemantics.js";

export {
  hasIconButtonAccessibleName,
  iconOnlyButtonProps,
} from "./iconButtonA11y.js";

export { default as StatusToneChip } from "./StatusToneChip.jsx";
export {
  resolveStatusToneStyle,
  STATUS_TONES,
  STATUS_TONE_STYLES,
} from "./statusToneStyles.js";

export { default as FieldError } from "./FieldError.jsx";
export { fieldControlAriaProps, fieldErrorId } from "./fieldFeedback.js";

/* —— Layer 2 shared patterns (Batch 2D) —— */
export { default as AuthPageHeader } from "./AuthPageHeader.jsx";
export { default as AuthConfirmDialog } from "./AuthConfirmDialog.jsx";
export { default as AuthEmptyState } from "./AuthEmptyState.jsx";
export { default as AuthLoadingState } from "./AuthLoadingState.jsx";
export { default as AuthErrorState } from "./AuthErrorState.jsx";
export { default as AuthResponsiveDataView } from "./AuthResponsiveDataView.jsx";
export { default as AuthFilterBar } from "./AuthFilterBar.jsx";
export { default as AppSnackbar, APP_SNACKBAR_TONES } from "./AppSnackbar.jsx";
export { default as AuthPatternHarness } from "./AuthPatternHarness.jsx";
