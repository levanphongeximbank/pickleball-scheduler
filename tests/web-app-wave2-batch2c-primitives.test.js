/**
 * Wave 2 Batch 2C â€” shared primitive contracts (node-safe + module imports).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { COLOR, COLOR_BOUNDARY, INTERACTION } from "../src/theme/designTokens.js";
import {
  BUTTON_LOADING_STRATEGY,
  BUTTON_SEMANTICS,
  buttonLoadingProps,
  sharedTouchTargetSx,
} from "../src/features/web-app-ui/buttonSemantics.js";
import {
  hasIconButtonAccessibleName,
  iconOnlyButtonProps,
} from "../src/features/web-app-ui/iconButtonA11y.js";
import {
  resolveStatusToneStyle,
  STATUS_TONES,
  STATUS_TONE_STYLES,
} from "../src/features/web-app-ui/statusToneStyles.js";
import {
  fieldControlAriaProps,
  fieldErrorId,
} from "../src/features/web-app-ui/fieldFeedback.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

test("batch2c â€” shared primitive location exists (AUTHENTICATED_SHARED)", () => {
  assert.equal(existsSync(path.join(root, "src/features/web-app-ui/index.js")), true);
  assert.equal(existsSync(path.join(root, "src/features/web-app-ui/StatusToneChip.jsx")), true);
  assert.equal(existsSync(path.join(root, "src/features/web-app-ui/FieldError.jsx")), true);
  assert.equal(existsSync(path.join(root, "src/features/web-app-ui/buttonSemantics.js")), true);
  assert.equal(existsSync(path.join(root, "src/features/web-app-ui/iconButtonA11y.js")), true);
});

test("batch2c â€” no parallel Button/Form/Card library wrappers", () => {
  for (const rel of [
    "src/features/web-app-ui/index.js",
    "src/features/web-app-ui/buttonSemantics.js",
    "src/features/web-app-ui/StatusToneChip.jsx",
    "src/features/web-app-ui/FieldError.jsx",
  ]) {
    const src = read(rel);
    assert.equal(/function CanonicalButton|export default function CanonicalButton/.test(src), false);
    assert.equal(/CanonicalCard|AuthCard|CanonicalTextField/.test(src), false);
  }
  assert.equal(existsSync(path.join(root, "src/ui")), false);
  assert.equal(existsSync(path.join(root, "packages/design-system")), false);
});

test("batch2c button â€” semantics map primary/destructive/success distinctly", () => {
  assert.deepEqual(BUTTON_SEMANTICS.primary, { variant: "contained", color: "primary" });
  assert.deepEqual(BUTTON_SEMANTICS.secondary, { variant: "outlined", color: "primary" });
  assert.deepEqual(BUTTON_SEMANTICS.tertiary, { variant: "text", color: "primary" });
  assert.deepEqual(BUTTON_SEMANTICS.destructive, { variant: "contained", color: "error" });
  assert.deepEqual(BUTTON_SEMANTICS.success, { variant: "contained", color: "success" });
  assert.notEqual(BUTTON_SEMANTICS.primary.color, BUTTON_SEMANTICS.destructive.color);
  assert.notEqual(BUTTON_SEMANTICS.primary.color, BUTTON_SEMANTICS.success.color);
  assert.equal(COLOR.primary.main, "#3B82F6");
  assert.equal(COLOR.success.main, "#10B981");
  assert.equal(COLOR.error.main, "#DC2626");
});

test("batch2c button â€” loading uses MUI native prop; no new dependency", () => {
  assert.equal(BUTTON_LOADING_STRATEGY, "MUI_BUTTON_NATIVE_LOADING_PROP");
  assert.deepEqual(buttonLoadingProps(false), { loading: false });
  const on = buttonLoadingProps(true);
  assert.equal(on.loading, true);
  assert.equal(on.disabled, true);
  assert.equal(on.loadingPosition, "start");

  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies?.["@mui/lab"], undefined);
  assert.equal(pkg.devDependencies?.["@mui/lab"], undefined);
  assert.ok(read("node_modules/@mui/material/Button/Button.d.ts").includes("loading?:"));
});

test("batch2c button â€” theme wires destructive/success + focus-visible + disabled", () => {
  const themeSrc = read("src/theme/theme.js");
  assert.ok(themeSrc.includes("containedError"));
  assert.ok(themeSrc.includes("outlinedError"));
  assert.ok(themeSrc.includes("containedSuccess"));
  assert.ok(themeSrc.includes("Mui-disabled"));
  assert.ok(themeSrc.includes("focus-visible"));
  assert.ok(themeSrc.includes("loading"));
  assert.equal(/from ["']@mui\/lab["']/.test(themeSrc), false);
  assert.equal(/import\s+.*@mui\/lab/.test(themeSrc), false);
});

test("batch2c button â€” shared touch target helper uses 44 without shell resize", () => {
  assert.equal(INTERACTION.touchTargetMin, 44);
  assert.deepEqual(sharedTouchTargetSx(), { minHeight: 44 });
  assert.equal(read("src/theme/theme.js").includes("sidebarItemHeight"), false);
  assert.equal(INTERACTION.frozenShellItemHeight, 40);
});

test("batch2c iconbutton â€” accessible name contract", () => {
  const props = iconOnlyButtonProps({ label: "Xoa dong" });
  assert.equal(props["aria-label"], "Xoa dong");
  assert.equal(props.title, "Xoa dong");
  assert.equal(props.sx.minWidth, 44);
  assert.equal(props.sx.minHeight, 44);
  assert.equal(hasIconButtonAccessibleName(props), true);
  assert.equal(hasIconButtonAccessibleName({}), false);
  assert.throws(() => iconOnlyButtonProps({ label: "  " }), /accessible name/);
});

test("batch2c StatusToneChip â€” tones map to auth semantic tokens; no hex API", () => {
  assert.deepEqual([...STATUS_TONES], ["neutral", "info", "success", "warning", "error", "primary"]);
  assert.equal(STATUS_TONE_STYLES.success.color, COLOR.success.dark);
  assert.equal(STATUS_TONE_STYLES.success.bgcolor, COLOR.success.light);
  assert.equal(STATUS_TONE_STYLES.info.color, COLOR.info.dark);
  assert.equal(STATUS_TONE_STYLES.error.color, COLOR.error.dark);
  assert.equal(STATUS_TONE_STYLES.warning.color, COLOR.warning.dark);
  assert.equal(STATUS_TONE_STYLES.neutral.color, COLOR.neutral.dark);
  assert.equal(resolveStatusToneStyle("unknown-tone").color, COLOR.neutral.dark);

  const src = read("src/features/web-app-ui/StatusToneChip.jsx");
  const stylesSrc = read("src/features/web-app-ui/statusToneStyles.js");
  assert.equal(/^import\s+.*ExperienceStatusChip/m.test(src), false);
  assert.equal(/from\s+["'].*tournamentExperienceTokens/.test(src), false);
  assert.equal(/from\s+["'].*publicPortalStyles/.test(src), false);
  assert.equal(stylesSrc.includes("#C5E831"), false);
  assert.equal(stylesSrc.includes("props.hex"), false);
  assert.ok(stylesSrc.includes('from "../../theme/designTokens.js"'));
});

test("batch2c FieldError â€” aria association without form framework", () => {
  assert.equal(fieldErrorId("email"), "email-error");
  const aria = fieldControlAriaProps({
    id: "email",
    error: true,
    errorMessage: "Email khong hop le",
  });
  assert.equal(aria.error, true);
  assert.equal(aria["aria-invalid"], true);
  assert.equal(aria["aria-describedby"], "email-error");

  const clean = fieldControlAriaProps({ id: "email", error: false });
  assert.equal(clean["aria-invalid"], undefined);
  assert.equal(clean["aria-describedby"], undefined);

  const src = read("src/features/web-app-ui/FieldError.jsx");
  const helperSrc = read("src/features/web-app-ui/fieldFeedback.js");
  assert.equal(src.includes("react-hook-form"), false);
  assert.equal(src.includes("formik"), false);
  assert.equal(helperSrc.includes("react-hook-form"), false);
  assert.ok(src.includes('role="alert"'));
});

test("batch2c â€” token lock regression still holds", () => {
  assert.equal(COLOR_BOUNDARY.authWorkspacePrimary, "#3B82F6");
  assert.equal(COLOR_BOUNDARY.authSuccess, "#10B981");
  assert.notEqual(COLOR.primary.main, COLOR.success.main);
});

test("batch2c â€” freeze boundaries: shell / experience present; primitives isolated", () => {
  const chip = read("src/features/web-app-ui/StatusToneChip.jsx");
  assert.equal(/^import\s+.*CanonicalAppShell/m.test(chip), false);
  assert.equal(/^import\s+.*ExperienceStatusChip/m.test(chip), false);
  assert.equal(existsSync(path.join(root, "src/features/canonical-shell")), true);
  assert.equal(
    existsSync(path.join(root, "src/features/tournament/experience-a1/visual/ExperienceStatusChip.jsx")),
    true
  );
});


