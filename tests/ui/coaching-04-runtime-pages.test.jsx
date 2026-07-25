/**
 * COACHING-04 UI cutover smoke — pages bind to runtime collection hook.
 * Activation: npm run test:ui -- tests/ui/coaching-04-runtime-pages.test.jsx
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "../../src/theme/theme.js";
import ClassesPage from "../../src/pages/coaching/ClassesPage.jsx";
import CoachListPage from "../../src/pages/coaching/CoachListPage.jsx";

const listMock = vi.fn(async () => ({ ok: true, data: [] }));
const saveMock = vi.fn(async () => ({ ok: true, data: {} }));
const deleteMock = vi.fn(async () => ({ ok: true, data: {} }));

vi.mock("../../src/context/ClubContext.jsx", () => ({
  useClub: () => ({
    activeClubId: "club-test-1",
    activeClub: { id: "club-test-1", name: "CLB Test" },
  }),
}));

vi.mock("../../src/features/coaching/runtime/createDefaultCoachingRuntime.js", () => ({
  getDefaultCoachingRuntime: () => ({
    mode: "legacy",
    listCollection: listMock,
    saveCollection: saveMock,
    deleteCollection: deleteMock,
    getStatus: () => ({ mode: "legacy", isDurable: false, isLegacy: true }),
  }),
  createDefaultCoachingRuntime: () => ({
    mode: "legacy",
    listCollection: listMock,
    saveCollection: saveMock,
    deleteCollection: deleteMock,
  }),
  resetDefaultCoachingRuntime: () => {},
  getCoachingPageGateway: () => ({}),
}));

function renderWithTheme(element) {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {element}
    </ThemeProvider>
  );
}

describe("COACHING-04 runtime page cutover UI", () => {
  beforeEach(() => {
    listMock.mockClear();
    listMock.mockResolvedValue({ ok: true, data: [] });
    if (!window.matchMedia) {
      window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      });
    }
  });

  it("ClassesPage loads via runtime collection (empty state)", async () => {
    renderWithTheme(<ClassesPage />);
    await waitFor(() => {
      expect(listMock).toHaveBeenCalled();
    });
    expect(await screen.findByText("Lớp học")).toBeTruthy();
    expect(screen.getByText("CLB: CLB Test")).toBeTruthy();
    expect(screen.getAllByText("Chưa có dữ liệu.").length).toBeGreaterThan(0);
  });

  it("CoachListPage loads coaches via runtime collection", async () => {
    listMock.mockResolvedValue({
      ok: true,
      data: [{ id: "c1", name: "HLV A", phone: "090", specialty: "singles", status: "active" }],
    });
    renderWithTheme(<CoachListPage />);
    await waitFor(() => {
      expect(listMock).toHaveBeenCalledWith("coaches", "club-test-1");
    });
    expect(await screen.findByText("HLV A")).toBeTruthy();
  });

  it("authorization denied surfaces clearly", async () => {
    listMock.mockResolvedValue({
      ok: false,
      code: "AUTHORIZATION_DENIED",
      error: "Không có quyền.",
    });
    renderWithTheme(<ClassesPage />);
    expect(await screen.findByText(/Không có quyền/i)).toBeTruthy();
  });
});
