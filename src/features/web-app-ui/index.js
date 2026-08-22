/**
 * Authenticated shared Layer 1 primitives (Wave 2 Batch 2C).
 *
 * Ownership: AUTHENTICATED_SHARED
 * Location: src/features/web-app-ui/
 *
 * Not a parallel design-system package — thin semantic helpers + visual chips
 * on top of MUI + src/theme.
 */

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
