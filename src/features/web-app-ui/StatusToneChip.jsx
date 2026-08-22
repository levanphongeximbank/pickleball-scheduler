/**
 * StatusToneChip — authenticated visual tone primitive (Wave 2 Batch 2C).
 *
 * Renders generic VISUAL tone only. Domain code maps PAID/ACTIVE/… → tone + label.
 * Does NOT encode domain status meaning.
 * Does NOT import Tournament ExperienceStatusChip or Public lime tokens.
 *
 * Tone helpers: import from `./statusToneStyles.js` or `./index.js`
 * (not re-exported here — keeps react-refresh/only-export-components clean).
 *
 * @ownership AUTHENTICATED_SHARED
 */

import { Chip } from "@mui/material";

import { resolveStatusToneStyle } from "./statusToneStyles.js";

/**
 * @param {object} props
 * @param {string} props.label — required visible text (status must not be color-only; label is required)
 * @param {'neutral'|'info'|'success'|'warning'|'error'|'primary'} [props.tone]
 * @param {'small'|'medium'} [props.size]
 * @param {import('react').ReactElement} [props.icon]
 * @param {object} [props.sx]
 *
 * Intentionally omitted from canonical API: `hex`, arbitrary bgcolor/color hex overrides.
 */
export default function StatusToneChip({
  tone = "neutral",
  label,
  size = "small",
  icon,
  sx,
  ...rest
}) {
  const text = label == null ? "" : String(label);
  const spec = resolveStatusToneStyle(tone);

  return (
    <Chip
      size={size}
      icon={icon || undefined}
      label={text}
      sx={{
        height: size === "medium" ? 28 : 24,
        fontWeight: 600,
        fontSize: 12,
        bgcolor: spec.bgcolor,
        color: spec.color,
        "& .MuiChip-label": { px: 0.75 },
        "& .MuiChip-icon": { color: `${spec.color} !important` },
        ...sx,
      }}
      {...rest}
    />
  );
}
