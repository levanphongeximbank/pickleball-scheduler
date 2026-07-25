/**
 * EC-03 Public data-source notice — Vitest + Testing Library.
 * Activation: `npm run test:ui -- tests/ui/public-data-source-notice.ui.test.jsx`
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import theme from "../../src/theme/theme.js";
import { PublicDataSourceNotice } from "../../src/components/public/states/index.js";
import { PUBLIC_PORTAL_DATA_SOURCE } from "../../src/features/experience-channels/public-portal/constants/dataSources.js";

function renderWithTheme(ui) {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {ui}
    </ThemeProvider>
  );
}

describe("EC-03 PublicDataSourceNotice", () => {
  it("does not render for LIVE source", () => {
    const { container } = renderWithTheme(
      <PublicDataSourceNotice source={PUBLIC_PORTAL_DATA_SOURCE.LIVE} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders MIXED notice with status role and textual reason", () => {
    renderWithTheme(
      <PublicDataSourceNotice
        source={PUBLIC_PORTAL_DATA_SOURCE.MIXED}
        fallbackReason="LIVE_EMPTY_USING_MOCK"
      />
    );
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.getByTestId("public-data-source-notice")).toHaveAttribute(
      "data-source",
      "MIXED"
    );
    expect(
      screen.getByRole("heading", { name: "Đang dùng dữ liệu dự phòng" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Mã dự phòng: LIVE_EMPTY_USING_MOCK/)).toBeInTheDocument();
  });

  it("renders MOCK notice with accessible text (not color-only)", () => {
    renderWithTheme(
      <PublicDataSourceNotice source={PUBLIC_PORTAL_DATA_SOURCE.MOCK} />
    );
    expect(screen.getByRole("heading", { name: "Dữ liệu minh họa" })).toBeInTheDocument();
    expect(
      screen.getByText(/không phải dữ liệu trực tiếp/i)
    ).toBeInTheDocument();
  });
});
