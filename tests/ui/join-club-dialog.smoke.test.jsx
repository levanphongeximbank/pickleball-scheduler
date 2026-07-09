import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import JoinClubDialog from "../../src/pages/player/myClub/JoinClubDialog.jsx";
import theme from "../../src/theme/theme.js";

const submitClubMembershipRequest = vi.fn();

vi.mock("../../src/features/club/index.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    submitClubMembershipRequest: (...args) => submitClubMembershipRequest(...args),
  };
});

function DialogShell(props) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <JoinClubDialog {...props} />
    </ThemeProvider>
  );
}

describe("JoinClubDialog", () => {
  const user = { id: "athlete-1", role: "PLAYER", displayName: "VĐV Test" };
  const preselectedClub = { id: "club-accc", name: "CLB ACCC" };

  beforeEach(() => {
    submitClubMembershipRequest.mockReset();
    submitClubMembershipRequest.mockReturnValue({ ok: true, request: { id: "req-1" } });
  });

  it("submits preselected club without Chọn CLB error", async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onClose = vi.fn();
    const uiUser = userEvent.setup();

    render(
      <DialogShell
        open
        user={user}
        preselectedClub={preselectedClub}
        clubs={[preselectedClub]}
        onSuccess={onSuccess}
        onError={onError}
        onClose={onClose}
      />
    );

    expect(screen.getByText("CLB ACCC")).toBeInTheDocument();
    expect(screen.queryByLabelText("Câu lạc bộ")).not.toBeInTheDocument();

    await uiUser.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));

    expect(onError).not.toHaveBeenCalled();
    expect(submitClubMembershipRequest).toHaveBeenCalledWith(
      "club-accc",
      expect.any(String),
      user,
      expect.objectContaining({ message: "" })
    );
    expect(onSuccess).toHaveBeenCalledWith("Đã gửi yêu cầu tham gia CLB.");
    expect(onClose).toHaveBeenCalled();
  });
});
