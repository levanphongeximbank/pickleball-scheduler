/**
 * Wave 2 Batch 2C — primitive a11y targeted contracts (node-safe).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { INTERACTION } from "../src/theme/designTokens.js";
import {
  hasIconButtonAccessibleName,
  iconOnlyButtonProps,
} from "../src/features/web-app-ui/iconButtonA11y.js";
import { fieldControlAriaProps } from "../src/features/web-app-ui/fieldFeedback.js";
import {
  BUTTON_LOADING_STRATEGY,
  BUTTON_SEMANTICS,
} from "../src/features/web-app-ui/buttonSemantics.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

test("batch2c a11y — icon-only actions require accessible name (not tooltip-only)", () => {
  const ok = iconOnlyButtonProps({ label: "Mo menu" });
  assert.equal(ok["aria-label"], "Mo menu");
  assert.equal(hasIconButtonAccessibleName({ title: "Mo menu" }), false);
  assert.equal(hasIconButtonAccessibleName({ "aria-label": "Mo menu" }), true);
  assert.equal(hasIconButtonAccessibleName({ "aria-labelledby": "lbl-1" }), true);
});

test("batch2c a11y — field error association contract", () => {
  const props = fieldControlAriaProps({
    id: "password",
    error: true,
    errorMessage: "Mat khau qua ngan",
  });
  assert.equal(props["aria-describedby"], "password-error");
  assert.equal(props["aria-invalid"], true);

  const fieldSrc = read("src/features/web-app-ui/FieldError.jsx");
  assert.ok(fieldSrc.includes('role="alert"'));
  assert.ok(fieldSrc.includes("FormHelperText"));
});

test("batch2c a11y — StatusToneChip always renders label (not color-only)", () => {
  const src = read("src/features/web-app-ui/StatusToneChip.jsx");
  assert.ok(src.includes("label={text}"));
  assert.ok(src.includes("label is required"));
  assert.ok(read("src/features/web-app-ui/statusToneStyles.js").includes("STATUS_TONES"));
});

test("batch2c a11y — loading + disabled button semantics documented", () => {
  assert.equal(BUTTON_SEMANTICS.destructive.color, "error");
  const themeSrc = read("src/theme/theme.js");
  assert.ok(themeSrc.includes("Mui-disabled"));
  assert.ok(themeSrc.includes("loading"));
  const btnSrc = read("src/features/web-app-ui/buttonSemantics.js");
  assert.ok(btnSrc.includes("buttonLoadingProps"));
  assert.ok(btnSrc.includes("disabled: true"));
  assert.equal(BUTTON_LOADING_STRATEGY, "MUI_BUTTON_NATIVE_LOADING_PROP");
});

test("batch2c a11y — focus-visible foundation retained from 2B", () => {
  assert.equal(INTERACTION.focusRing, "#3B82F6");
  const themeSrc = read("src/theme/theme.js");
  assert.ok(themeSrc.includes("MuiButton"));
  assert.ok(themeSrc.includes("MuiIconButton"));
  assert.ok(themeSrc.includes("focus-visible"));
});

test("batch2c a11y — critical primitive gaps in 2C scope = 0 (contract coverage)", () => {
  const checks = [
    hasIconButtonAccessibleName(iconOnlyButtonProps({ label: "Luu" })),
    fieldControlAriaProps({ id: "x", error: true, errorMessage: "Loi" })["aria-describedby"] ===
      "x-error",
    read("src/features/web-app-ui/StatusToneChip.jsx").includes("label={text}"),
    read("src/features/web-app-ui/buttonSemantics.js").includes("MUI_BUTTON_NATIVE_LOADING_PROP"),
    read("src/theme/theme.js").includes("containedError"),
  ];
  assert.equal(checks.every(Boolean), true);
  assert.equal(checks.filter((c) => !c).length, 0);
});
