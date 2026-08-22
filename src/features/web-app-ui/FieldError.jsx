/**
 * FieldError — authenticated field feedback primitive (Wave 2 Batch 2C).
 *
 * Visible error copy + aria association helpers for MUI TextField/Select/etc.
 * Not a form framework — works with or without RHF/Formik.
 *
 * Helpers: import from `./fieldFeedback.js` or `./index.js` (not re-exported here —
 * keeps react-refresh/only-export-components clean).
 *
 * @ownership AUTHENTICATED_SHARED
 */

import FormHelperText from "@mui/material/FormHelperText";

/**
 * Visible field error message.
 *
 * @param {object} props
 * @param {string} [props.id] — should match aria-describedby on the control
 * @param {import('react').ReactNode} props.children — Vietnamese-friendly error copy
 * @param {boolean} [props.visible=true]
 */
export default function FieldError({ id, children, visible = true, sx, ...rest }) {
  if (!visible || children == null || children === false || children === "") {
    return null;
  }

  return (
    <FormHelperText
      id={id}
      error
      component="p"
      role="alert"
      sx={{
        mt: 0.5,
        mx: 0,
        ...sx,
      }}
      {...rest}
    >
      {children}
    </FormHelperText>
  );
}
