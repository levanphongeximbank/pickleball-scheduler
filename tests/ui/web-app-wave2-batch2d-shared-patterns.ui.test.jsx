/**
 * Wave 2 Batch 2D — shared pattern UI harness (Vitest).
 * Activation: `npx vitest run tests/ui/web-app-wave2-batch2d-shared-patterns.ui.test.jsx`
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import useMediaQuery from "@mui/material/useMediaQuery";

import theme from "../../src/theme/theme.js";
import {
  AppSnackbar,
  AuthConfirmDialog,
  AuthEmptyState,
  AuthErrorState,
  AuthFilterBar,
  AuthLoadingState,
  AuthPageHeader,
  AuthResponsiveDataView,
} from "../../src/features/web-app-ui/index.js";

vi.mock("@mui/material/useMediaQuery", () => ({
  default: vi.fn(() => false),
}));

function renderWithProviders(ui) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {ui}
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("Batch 2D AuthPageHeader", () => {
  it("renders title as h1 with actions and optional subtitle", () => {
    renderWithProviders(
      <AuthPageHeader
        title="Nguoi choi"
        subtitle="Quan ly danh sach"
        primaryAction={<Button>Them</Button>}
        secondaryActions={<Button>Nhap</Button>}
      />
    );
    expect(screen.getByRole("heading", { level: 1, name: "Nguoi choi" })).toBeInTheDocument();
    expect(screen.getByText("Quan ly danh sach")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Them" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nhap" })).toBeInTheDocument();
  });
});

describe("Batch 2D AuthConfirmDialog", () => {
  it("supports cancel/confirm and destructive error semantics", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    renderWithProviders(
      <AuthConfirmDialog
        open
        title="Xoa ban ghi?"
        message="Khong the hoan tac."
        confirmTone="destructive"
        confirmLabel="Xoa"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Xoa ban ghi?")).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Xoa" });
    expect(confirm.className).toMatch(/MuiButton-colorError|MuiButton-containedError/);
    await user.click(screen.getByRole("button", { name: "Huy" }));
    expect(onCancel).toHaveBeenCalled();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalled();
  });

  it("blocks dismiss and disables confirm while loading", () => {
    renderWithProviders(
      <AuthConfirmDialog
        open
        title="Dang xu ly"
        message="Vui long cho"
        loading
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /Dang xu ly/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Huy" })).toBeDisabled();
  });
});

describe("Batch 2D state views", () => {
  it("empty/loading/error announce safely without raw developer dump", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = renderWithProviders(
      <AuthEmptyState title="Trong" description="Chua co du lieu domain." />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Trong");

    rerender(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <AuthLoadingState label="Dang tai…" />
        </ThemeProvider>
      </MemoryRouter>
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");

    rerender(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <AuthErrorState message="Loi mang an toan." onRetry={onRetry} />
        </ThemeProvider>
      </MemoryRouter>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Loi mang an toan.");
    expect(screen.queryByText(/at Object|supabase|stack/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Thu lai|Thử lại/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("Batch 2D AuthResponsiveDataView", () => {
  const columns = [
    { field: "name", headerName: "Ten" },
    { field: "role", headerName: "Vai tro" },
  ];
  const rows = [
    { id: "a", name: "An", role: "Admin" },
    { id: "b", name: "Binh", role: "Member" },
  ];

  it("renders desktop table with row identity", () => {
    useMediaQuery.mockReturnValue(false);
    renderWithProviders(
      <AuthResponsiveDataView columns={columns} rows={rows} getRowId={(r) => r.id} />
    );
    expect(screen.getByTestId("auth-responsive-data-desktop")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Ten" })).toBeInTheDocument();
    expect(screen.getByText("An")).toBeInTheDocument();
  });

  it("renders mobile cards when compact viewport", () => {
    useMediaQuery.mockReturnValue(true);
    renderWithProviders(
      <AuthResponsiveDataView columns={columns} rows={rows} getRowId={(r) => r.id} />
    );
    expect(screen.getByTestId("auth-responsive-data-mobile")).toBeInTheDocument();
    expect(screen.getByText("Binh")).toBeInTheDocument();
  });

  it("wires empty/loading/error states", () => {
    useMediaQuery.mockReturnValue(false);
    const { rerender } = renderWithProviders(
      <AuthResponsiveDataView columns={columns} rows={[]} loading />
    );
    expect(screen.getByTestId("auth-loading-state")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <AuthResponsiveDataView columns={columns} rows={[]} />
        </ThemeProvider>
      </MemoryRouter>
    );
    expect(screen.getByTestId("auth-empty-state")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <AuthResponsiveDataView columns={columns} rows={[]} error errorMessage="Loi tai" />
        </ThemeProvider>
      </MemoryRouter>
    );
    expect(screen.getByTestId("auth-error-state")).toBeInTheDocument();
  });
});

describe("Batch 2D AuthFilterBar + AppSnackbar", () => {
  it("composes filter slots without owning filter state", () => {
    renderWithProviders(
      <AuthFilterBar
        search={<TextField label="Tim" />}
        filters={<TextField label="Loc" />}
        resultCount={3}
        resetAction={<Button>Reset</Button>}
      />
    );
    const bar = screen.getByTestId("auth-filter-bar");
    expect(within(bar).getByLabelText("Tim")).toBeInTheDocument();
    expect(within(bar).getByText(/3/)).toBeInTheDocument();
  });

  it("shows snackbar message text with live region", () => {
    renderWithProviders(
      <AppSnackbar open message="Da luu thanh cong" tone="success" onClose={() => {}} />
    );
    expect(screen.getByText("Da luu thanh cong")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});
