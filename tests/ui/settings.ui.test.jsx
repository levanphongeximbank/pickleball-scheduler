import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "./testUtils.jsx";
import ClubSwitcher from "../../src/components/ClubSwitcher.jsx";
import { loadClubData, saveClubData } from "../../src/domain/clubStorage.js";
import userEvent from "@testing-library/user-event";

import Settings from "../../src/pages/Settings";

function seedSettingsWithMultipleClubs() {
  localStorage.clear();

  localStorage.setItem(
    "pickleball-clubs-v1",
    JSON.stringify([
      { id: "default-club", name: "CLB Mac dinh" },
      { id: "club-b", name: "CLB B" },
    ])
  );
  localStorage.setItem("pickleball-active-club-v1", "default-club");

  localStorage.setItem(
    "pickleball-ai::default-club",
    JSON.stringify({
      schemaVersion: 1,
      history: {
        p1: { games: 2, partners: {}, opponents: {} },
        p2: { games: 1, partners: {}, opponents: {} },
      },
      waiting: {},
      sessions: [{ id: 1 }, { id: 2 }],
      policies: [{ id: 1, enabled: true }],
      rules: [{ id: 1, enabled: true }],
    })
  );

  localStorage.setItem(
    "pickleball-ai::club-b",
    JSON.stringify({
      schemaVersion: 1,
      history: {
        p1: { games: 3, partners: {}, opponents: {} },
        p2: { games: 2, partners: {}, opponents: {} },
        p3: { games: 1, partners: {}, opponents: {} },
      },
      waiting: {},
      sessions: [{ id: 11 }, { id: 12 }, { id: 13 }, { id: 14 }, { id: 15 }],
      policies: [{ id: 1, enabled: true }, { id: 2, enabled: false }],
      rules: [{ id: 1, enabled: true }, { id: 2, enabled: true }],
    })
  );
}

describe("Settings UI", () => {
  beforeEach(() => {
    seedSettingsWithMultipleClubs();
  });

  it("updates Data health metrics when switching active club", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ClubSwitcher />
        <Settings />
      </>
    );

    expect(screen.getByText("Sessions: 2")).toBeInTheDocument();
    expect(screen.getByText("History players: 2")).toBeInTheDocument();
    expect(screen.getByText("Policies: 1")).toBeInTheDocument();
    expect(screen.getByText("Rules: 1")).toBeInTheDocument();

    await user.click(screen.getByLabelText("CLB"));
    await user.click(screen.getByRole("option", { name: "CLB B" }));

    expect(await screen.findByText("Sessions: 5")).toBeInTheDocument();
    expect(screen.getByText("History players: 3")).toBeInTheDocument();
    expect(screen.getByText("Policies: 2")).toBeInTheDocument();
    expect(screen.getByText("Rules: 2")).toBeInTheDocument();
  });

  it("syncs and pulls cloud data for the active club without mixing clubs", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ClubSwitcher />
        <Settings />
      </>
    );

    await user.click(screen.getByLabelText("CLB"));
    await user.click(screen.getByRole("option", { name: "CLB B" }));

    expect(await screen.findByText("Sessions: 5")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Đồng bộ lên cloud" }));

    const clearedClubData = loadClubData("club-b");
    saveClubData("club-b", {
      ...clearedClubData,
      sessions: [],
      ai: {
        ...clearedClubData.ai,
        history: {},
        policies: [],
        rules: [],
      },
    });

    await user.click(screen.getByLabelText("CLB"));
    await user.click(screen.getByRole("option", { name: "CLB Mac dinh" }));
    await user.click(screen.getByLabelText("CLB"));
    await user.click(screen.getByRole("option", { name: "CLB B" }));

    expect(await screen.findByText("Sessions: 0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Lấy dữ liệu từ cloud" }));

    expect(await screen.findByText("Sessions: 5")).toBeInTheDocument();
    expect(screen.getByText("History players: 3")).toBeInTheDocument();
  });

  it("shows error when pulling cloud data without a synced snapshot", async () => {
    const user = userEvent.setup();

    localStorage.removeItem("pickleball-cloud-db-v1");
    render(<Settings />);

    await user.click(screen.getByRole("button", { name: "Lấy dữ liệu từ cloud" }));

    expect(
      await screen.findByText("Khong tim thay du lieu cloud cho CLB hien tai.")
    ).toBeInTheDocument();
  });
});
