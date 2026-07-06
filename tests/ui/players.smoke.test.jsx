import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "./testUtils.jsx";
import Players from "../../src/pages/Players.jsx";

function seedPlayers() {
  localStorage.clear();
  localStorage.setItem(
    "players",
    JSON.stringify([{ id: 1, name: "An", level: 3.0, gender: "Nam" }])
  );
}

describe("Players page smoke", () => {
  it("renders roster and validates empty name on save", async () => {
    seedPlayers();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Players />
      </MemoryRouter>
    );

    expect(screen.getByText("Quản lý người chơi")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Thêm người chơi/i }));
    await user.click(screen.getByRole("button", { name: /^Lưu$/i }));

    expect(screen.getByText("Vui lòng nhập họ tên")).toBeInTheDocument();
  });
});
