/**
 * Wave 2 Batch 2C â€” primitive UI render harness (Vitest).
 * Activation: `npm run test:ui -- tests/ui/web-app-wave2-batch2c-primitives.ui.test.jsx`
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import DeleteIcon from "@mui/icons-material/Delete";

import theme from "../../src/theme/theme.js";
import { COLOR } from "../../src/theme/designTokens.js";
import {
  BUTTON_SEMANTICS,
  buttonLoadingProps,
  FieldError,
  fieldControlAriaProps,
  fieldErrorId,
  iconOnlyButtonProps,
  StatusToneChip,
  STATUS_TONES,
} from "../../src/features/web-app-ui/index.js";

function renderWithTheme(ui) {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {ui}
    </ThemeProvider>
  );
}

describe("Batch 2C button primitives", () => {
  it("primary uses semantic primary blue", () => {
    renderWithTheme(
      <Button {...BUTTON_SEMANTICS.primary} data-testid="btn-primary">
        Luu
      </Button>
    );
    const btn = screen.getByTestId("btn-primary");
    expect(btn).toHaveClass("MuiButton-contained");
    expect(btn).toHaveClass("MuiButton-colorPrimary");
    expect(theme.palette.primary.main).toBe(COLOR.primary.main);
    expect(theme.palette.primary.main).toBe("#3B82F6");
  });

  it("destructive uses error semantics (not primary)", () => {
    renderWithTheme(
      <Button {...BUTTON_SEMANTICS.destructive} data-testid="btn-danger">
        Xoa
      </Button>
    );
    const btn = screen.getByTestId("btn-danger");
    expect(btn).toHaveClass("MuiButton-contained");
    expect(btn).toHaveClass("MuiButton-colorError");
    expect(btn).not.toHaveClass("MuiButton-colorPrimary");
    expect(theme.palette.error.main).toBe("#DC2626");
  });

  it("success remains distinct from primary", () => {
    renderWithTheme(
      <Button {...BUTTON_SEMANTICS.success} data-testid="btn-success">
        Hoan tat
      </Button>
    );
    const btn = screen.getByTestId("btn-success");
    expect(btn).toHaveClass("MuiButton-contained");
    expect(btn).toHaveClass("MuiButton-colorSuccess");
    expect(theme.palette.success.main).toBe("#10B981");
    expect(theme.palette.success.main).not.toBe(theme.palette.primary.main);
  });

  it("disabled and loading states are supported", () => {
    const { rerender } = renderWithTheme(
      <Button disabled data-testid="btn-disabled">
        Khoa
      </Button>
    );
    expect(screen.getByTestId("btn-disabled")).toBeDisabled();

    rerender(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Button {...buttonLoadingProps(true)} data-testid="btn-loading">
          Dang luu
        </Button>
      </ThemeProvider>
    );
    const loading = screen.getByTestId("btn-loading");
    expect(loading).toBeDisabled();
    expect(
      loading.className.includes("MuiButton-loading") || loading.getAttribute("aria-busy") === "true"
    ).toBe(true);
  });
});

describe("Batch 2C IconButton a11y", () => {
  it("icon-only action exposes accessible name", () => {
    renderWithTheme(
      <IconButton {...iconOnlyButtonProps({ label: "Xoa ban ghi" })}>
        <DeleteIcon />
      </IconButton>
    );
    expect(screen.getByRole("button", { name: "Xoa ban ghi" })).toBeInTheDocument();
  });
});

describe("Batch 2C StatusToneChip", () => {
  it("renders label for every canonical tone", () => {
    renderWithTheme(
      <>
        {STATUS_TONES.map((tone) => (
          <StatusToneChip key={tone} tone={tone} label={`Nhan ${tone}`} />
        ))}
      </>
    );
    for (const tone of STATUS_TONES) {
      expect(screen.getByText(`Nhan ${tone}`)).toBeInTheDocument();
    }
  });
});

describe("Batch 2C FieldError", () => {
  it("shows visible error with alert role and control association", () => {
    const controlId = "club-name";
    const errId = fieldErrorId(controlId);
    const controlProps = fieldControlAriaProps({
      id: controlId,
      error: true,
      errorMessage: "Ten CLB la bat buoc",
    });

    renderWithTheme(
      <>
        <TextField
          label="Ten CLB"
          error={controlProps.error}
          id={controlProps.id}
          slotProps={{
            htmlInput: {
              "aria-invalid": controlProps["aria-invalid"],
              "aria-describedby": controlProps["aria-describedby"],
            },
          }}
        />
        <FieldError id={errId}>Ten CLB la bat buoc</FieldError>
      </>
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Ten CLB la bat buoc");
    expect(alert).toHaveAttribute("id", "club-name-error");

    const input = screen.getByLabelText("Ten CLB");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby") || "").toContain("club-name-error");
  });
});


