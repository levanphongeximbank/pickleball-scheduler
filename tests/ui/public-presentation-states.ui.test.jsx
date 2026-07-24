/**
 * EC-02 Public Portal presentation states — Vitest + Testing Library.
 * Activation: `npm run test:ui -- tests/ui/public-presentation-states.ui.test.jsx`
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import theme from "../../src/theme/theme.js";
import {
  PublicEmptyState,
  PublicErrorState,
  PublicLoadingState,
  PublicUnavailableState,
} from "../../src/components/public/states/index.js";
import { usePublicDocumentTitle } from "../../src/components/public/usePublicDocumentTitle.js";

function renderWithTheme(ui) {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {ui}
    </ThemeProvider>
  );
}

function TitleProbe({ title }) {
  usePublicDocumentTitle(title);
  return <div data-testid="title-probe">ok</div>;
}

describe("EC-02 Public presentation states", () => {
  it("loading state exposes polite status and accessible text", () => {
    renderWithTheme(
      <PublicLoadingState title="Đang tải danh sách" message="Vui lòng chờ" />
    );
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("heading", { name: "Đang tải danh sách" })).toBeInTheDocument();
    expect(screen.getByText("Vui lòng chờ")).toBeInTheDocument();
    expect(screen.getByTestId("public-loading-state")).toBeInTheDocument();
  });

  it("empty state heading/message and keyboard-activatable action", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderWithTheme(
      <PublicEmptyState
        title="Không tìm thấy CLB phù hợp"
        message="Thử đổi từ khóa."
        actionLabel="Xóa bộ lọc"
        onAction={onAction}
      />
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Không tìm thấy CLB phù hợp" })
    ).toBeInTheDocument();
    expect(screen.getByText("Thử đổi từ khóa.")).toBeInTheDocument();

    const action = screen.getByRole("button", { name: "Xóa bộ lọc" });
    action.focus();
    expect(action).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("error state uses alert role and is not color-only", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderWithTheme(
      <PublicErrorState
        title="Không tải được nội dung"
        message="Đã xảy ra lỗi khi hiển thị dữ liệu công khai."
        actionLabel="Thử lại"
        onAction={onAction}
      />
    );

    expect(screen.getByTestId("public-error-state")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Không tải được nội dung" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Đã xảy ra lỗi khi hiển thị dữ liệu công khai.")
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("unavailable state communicates non-critical status", () => {
    renderWithTheme(
      <PublicUnavailableState
        title="Nội dung tạm thời không khả dụng"
        message="Phần nội dung này hiện chưa sẵn sàng."
      />
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Nội dung tạm thời không khả dụng" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("public-unavailable-state")).toBeInTheDocument();
  });

  it("long titles wrap without forcing a fixed desktop width", () => {
    const long =
      "Tiêu đề rất dài để kiểm tra wrap trên mobile tablet desktop không tràn ngang và vẫn đọc được";
    renderWithTheme(<PublicEmptyState title={long} message={`${long}. ${long}`} />);
    const root = screen.getByTestId("public-empty-state");
    expect(root).toHaveStyle({ maxWidth: "100%" });
    expect(screen.getByRole("heading", { name: long })).toBeInTheDocument();
  });

  it("usePublicDocumentTitle sets deterministic page-local title", () => {
    const previous = document.title;
    const { unmount } = renderWithTheme(<TitleProbe title="Câu lạc bộ" />);
    expect(document.title).toBe("Câu lạc bộ · PICK_VN");
    unmount();
    expect(document.title).toBe(previous);
  });
});
