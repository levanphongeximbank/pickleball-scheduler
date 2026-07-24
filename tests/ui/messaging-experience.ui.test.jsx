/**
 * COMMS-06 Messaging Experience UI smoke (Vitest + Testing Library — already in repo).
 * Activation: `npm run test:ui -- tests/ui/messaging-experience.ui.test.jsx`
 */
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "../../src/theme/theme.js";
import MessagingExperiencePage from "../../src/features/communication/experience/MessagingExperiencePage.jsx";
import { MESSAGING_MENU_LEAF } from "../../src/config/v5Menu/messagingMenu.js";

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={["/messages"]}>
        <Routes>
          <Route path="/messages" element={<MessagingExperiencePage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("COMMS-06 Messaging Experience UI", () => {
  beforeEach(() => {
    if (!window.matchMedia) {
      window.matchMedia = (query) => ({
        matches: String(query).includes("max-width") ? false : false,
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

  it("renders messaging route shell and menu label contract", async () => {
    expect(MESSAGING_MENU_LEAF.text).toBe("Tin nhắn");
    expect(MESSAGING_MENU_LEAF.path).toBe("/messages");

    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Tin nhắn" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("messaging-experience-page")).toBeInTheDocument();
    expect(screen.getByTestId("messaging-shell")).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Phân loại tin nhắn" })).toBeInTheDocument();
  });

  it("desktop shell exposes three-column layout marker", async () => {
    renderPage();
    expect(
      await screen.findByTestId("messaging-desktop-columns")
    ).toBeInTheDocument();
  });

  it("opens a direct conversation and shows composer", async () => {
    const user = userEvent.setup();
    renderPage();
    const list = await screen.findByLabelText("Danh sách hội thoại");
    const item = await within(list).findByRole("button", { name: /Minh Trần/i });
    await user.click(item);
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: /Nội dung tin nhắn|Soạn tin nhắn/i })
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Gửi tin nhắn" })).toBeInTheDocument();
  });

  it("keyboard: tablist is accessible", async () => {
    renderPage();
    expect(
      await screen.findByRole("tablist", { name: "Phân loại tin nhắn" })
    ).toBeInTheDocument();
  });
});
