import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import theme from "../../src/theme/theme.js";
import ClubsPage from "../../src/pages/public/ClubsPage.jsx";
import CourtsPage from "../../src/pages/public/CourtsPage.jsx";
import {
  PUBLIC_PORTAL_EMPTY_CLUBS_MESSAGE,
  PUBLIC_PORTAL_EMPTY_COURTS_MESSAGE,
  PUBLIC_PORTAL_ERROR_USER_MESSAGE,
  PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE,
} from "../../src/features/public-portal/runtime/constants.js";
import { PUBLIC_DATA_RESULT_STATUS } from "../../src/features/experience-channels/public-portal/data-source/index.js";
import { PUBLIC_PORTAL_DATA_SOURCE } from "../../src/features/experience-channels/public-portal/constants/dataSources.js";

const mockLoadClubs = vi.fn();
const mockLoadCourts = vi.fn();
const mockHc = vi.fn(() => false);

vi.mock("../../src/features/public-portal/services/publicClubsCourtsDataSource.js", async () => {
  const actual = await vi.importActual(
    "../../src/features/public-portal/services/publicClubsCourtsDataSource.js"
  );
  return {
    ...actual,
    loadPublicClubsPageResult: (...args) => mockLoadClubs(...args),
    loadPublicCourtsPageResult: (...args) => mockLoadCourts(...args),
  };
});

vi.mock("../../src/features/platform-hard-cutover/index.js", async () => {
  const actual = await vi.importActual("../../src/features/platform-hard-cutover/index.js");
  return {
    ...actual,
    isPlatformHardCutoverEnabled: (...args) => mockHc(...args),
  };
});

function renderClubs() {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter>
        <ClubsPage />
      </MemoryRouter>
    </ThemeProvider>
  );
}

function renderCourts() {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter>
        <CourtsPage />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("Public Portal post-wipe honesty UI", () => {
  beforeEach(() => {
    mockHc.mockReturnValue(true);
    mockLoadClubs.mockReset();
    mockLoadCourts.mockReset();
  });

  afterEach(() => {
    mockHc.mockReturnValue(false);
  });

  it("HC ON canonical empty shows Vietnamese empty state without mock clubs", async () => {
    mockLoadClubs.mockResolvedValue({
      source: PUBLIC_PORTAL_DATA_SOURCE.LIVE,
      status: PUBLIC_DATA_RESULT_STATUS.EMPTY,
      data: [],
      error: null,
      fallbackUsed: false,
      fallbackReason: null,
      productionReady: false,
      ownerSurface: "public-clubs",
    });

    renderClubs();
    await waitFor(() => {
      expect(screen.getByTestId("public-empty-state")).toBeInTheDocument();
    });
    expect(screen.getByText(PUBLIC_PORTAL_EMPTY_CLUBS_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/Dữ liệu minh họa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/thành viên/i)).not.toBeInTheDocument();
  });

  it("HC ON unavailable shows typed Vietnamese unavailable copy", async () => {
    mockLoadClubs.mockResolvedValue({
      source: PUBLIC_PORTAL_DATA_SOURCE.UNKNOWN,
      status: PUBLIC_DATA_RESULT_STATUS.UNAVAILABLE,
      data: [],
      error: {
        code: "PUBLIC_CATALOG_UNAVAILABLE",
        message: PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE,
      },
      fallbackUsed: false,
      fallbackReason: null,
      productionReady: false,
      ownerSurface: "public-clubs",
    });

    renderClubs();
    await waitFor(() => {
      expect(screen.getByTestId("public-unavailable-state")).toBeInTheDocument();
    });
    expect(screen.getByText(PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE)).toBeInTheDocument();
  });

  it("HC ON sanitized error does not expose raw backend details", async () => {
    mockLoadCourts.mockResolvedValue({
      source: PUBLIC_PORTAL_DATA_SOURCE.LIVE,
      status: PUBLIC_DATA_RESULT_STATUS.ERROR,
      data: [],
      error: {
        code: "PUBLIC_CATALOG_REMOTE_FAILED",
        message: PUBLIC_PORTAL_ERROR_USER_MESSAGE,
      },
      fallbackUsed: false,
      fallbackReason: null,
      productionReady: false,
      ownerSurface: "public-courts",
    });

    renderCourts();
    await waitFor(() => {
      expect(screen.getByTestId("public-error-state")).toBeInTheDocument();
    });
    expect(screen.getByText(PUBLIC_PORTAL_ERROR_USER_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/supabase|postgres|service_role/i)).not.toBeInTheDocument();
    expect(screen.queryByText(PUBLIC_PORTAL_EMPTY_COURTS_MESSAGE)).not.toBeInTheDocument();
  });

  it("HC ON ready renders canonical club without fabricated member counts", async () => {
    mockLoadClubs.mockResolvedValue({
      source: PUBLIC_PORTAL_DATA_SOURCE.LIVE,
      status: PUBLIC_DATA_RESULT_STATUS.SUCCESS,
      data: [
        {
          id: "pub-1",
          name: "CLB Công Khai Wave A3",
          city: "Huế",
          members: null,
          tournaments: null,
        },
      ],
      error: null,
      fallbackUsed: false,
      fallbackReason: null,
      productionReady: false,
      ownerSurface: "public-clubs",
    });

    renderClubs();
    await waitFor(() => {
      expect(screen.getByText("CLB Công Khai Wave A3")).toBeInTheDocument();
    });
    expect(screen.queryByText(/thành viên/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/giải đã tổ chức/i)).not.toBeInTheDocument();
  });

  it("loading terminates and never stays blank without a state", async () => {
    let resolveClubs;
    mockLoadClubs.mockReturnValue(
      new Promise((resolve) => {
        resolveClubs = resolve;
      })
    );

    renderClubs();
    expect(screen.getByTestId("public-loading-state")).toBeInTheDocument();

    resolveClubs({
      source: PUBLIC_PORTAL_DATA_SOURCE.LIVE,
      status: PUBLIC_DATA_RESULT_STATUS.EMPTY,
      data: [],
      error: null,
      fallbackUsed: false,
      fallbackReason: null,
      productionReady: false,
      ownerSurface: "public-clubs",
    });

    await waitFor(() => {
      expect(screen.queryByTestId("public-loading-state")).not.toBeInTheDocument();
      expect(screen.getByTestId("public-empty-state")).toBeInTheDocument();
    });
  });
});
