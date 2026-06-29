import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, SCOPED_DIRECTOR_KEY } from "./testUtils.jsx";
import ClubSwitcher from "../../src/components/ClubSwitcher.jsx";
import userEvent from "@testing-library/user-event";

import SelectPlayers from "../../src/pages/SelectPlayers";

const mockRunAI = vi.fn();

vi.mock("../../src/ai/engine", () => ({
  runAI: (...args) => mockRunAI(...args),
}));

function seedStorage() {
  localStorage.clear();

  localStorage.setItem(
    "players",
    JSON.stringify([
      { id: 1, name: "An", level: 3.0 },
      { id: 2, name: "Binh", level: 3.2 },
      { id: 3, name: "Cuong", level: 2.8 },
      { id: 4, name: "Dung", level: 3.5 },
      { id: 5, name: "Em", level: 2.5 },
    ])
  );

  localStorage.setItem(
    "courts",
    JSON.stringify([
      { id: 101, name: "Sân 1", active: true },
      { id: 102, name: "Sân 2", active: true },
    ])
  );
}

function seedStorageWithPlayerCount(count) {
  localStorage.clear();

  const players = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Player ${index + 1}`,
    level: 2.5 + (index % 5) * 0.2,
  }));

  localStorage.setItem("players", JSON.stringify(players));
  localStorage.setItem(
    "courts",
    JSON.stringify([
      { id: 101, name: "Sân 1", active: true },
      { id: 102, name: "Sân 2", active: true },
    ])
  );
}

function seedStorageWithInactiveCourt() {
  localStorage.clear();

  localStorage.setItem(
    "players",
    JSON.stringify([
      { id: 1, name: "An", level: 3.0 },
      { id: 2, name: "Binh", level: 3.2 },
      { id: 3, name: "Cuong", level: 2.8 },
      { id: 4, name: "Dung", level: 3.5 },
      { id: 5, name: "Em", level: 2.5 },
    ])
  );

  localStorage.setItem(
    "courts",
    JSON.stringify([
      { id: 101, name: "Sân 1", active: true },
      { id: 102, name: "Sân 2", active: false },
      { id: 103, name: "Sân 3", active: true },
    ])
  );
}

function seedStorageWithMultipleClubs() {
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
    "players::default-club",
    JSON.stringify([
      { id: 1, name: "An Default", level: 3.0 },
      { id: 2, name: "Binh Default", level: 3.2 },
      { id: 3, name: "Cuong Default", level: 2.8 },
      { id: 4, name: "Dung Default", level: 3.5 },
    ])
  );

  localStorage.setItem(
    "players::club-b",
    JSON.stringify([
      { id: 101, name: "Bao ClubB", level: 2.6 },
      { id: 102, name: "Ha ClubB", level: 3.1 },
      { id: 103, name: "Nam ClubB", level: 3.3 },
      { id: 104, name: "Phuc ClubB", level: 2.9 },
    ])
  );

  localStorage.setItem(
    "courts::default-club",
    JSON.stringify([
      { id: 101, name: "Sân 1", active: true },
      { id: 102, name: "Sân 2", active: true },
    ])
  );

  localStorage.setItem(
    "courts::club-b",
    JSON.stringify([
      { id: 201, name: "Sân B1", active: true },
      { id: 202, name: "Sân B2", active: true },
    ])
  );
}

function seedStorageWithCompetitionPlayers() {
  localStorage.clear();

  localStorage.setItem(
    "players",
    JSON.stringify([
      { id: 1, name: "An", gender: "Nam", level: 3.0 },
      { id: 2, name: "Binh", gender: "Nam", level: 3.2 },
      { id: 3, name: "Cuong", gender: "Nam", level: 2.8 },
      { id: 4, name: "Ha", gender: "Nữ", level: 3.1 },
      { id: 5, name: "Linh", gender: "Nữ", level: 2.9 },
      { id: 6, name: "My", gender: "Nữ", level: 3.4 },
    ])
  );

  localStorage.setItem(
    "courts",
    JSON.stringify([
      { id: 101, name: "Sân 1", active: true },
      { id: 102, name: "Sân 2", active: true },
    ])
  );
}

function buildMockScheduleResult() {
  return {
    courts: [
      {
        court: 101,
        courtName: "Sân 1",
        teamA: [
          { id: 1, name: "An", level: 3.0 },
          { id: 2, name: "Binh", level: 3.2 },
        ],
        teamB: [
          { id: 3, name: "Cuong", level: 2.8 },
          { id: 4, name: "Dung", level: 3.5 },
        ],
        teamATotal: 6.2,
        teamBTotal: 6.3,
        diff: 0.1,
        detailScore: {
          levelScore: 95,
          historyScore: 90,
          ruleScore: 100,
          policyScore: 0,
        },
        score: 92,
      },
    ],
    waiting: [],
    aiScore: {
      total: 92,
      balance: 95,
      history: 90,
      waiting: 100,
      rules: 100,
      policy: 100,
    },
    candidates: [{ totalScore: 92 }],
    bestCandidateScore: 92,
  };
}

async function selectFirstFourPlayers(user) {
  const playerChecks = screen
    .getAllByRole("checkbox")
    .filter((item) => !item.hasAttribute("disabled"));

  await user.click(playerChecks[2]);
  await user.click(playerChecks[3]);
  await user.click(playerChecks[4]);
  await user.click(playerChecks[5]);
}

describe("SelectPlayers UI", () => {
  beforeEach(() => {
    mockRunAI.mockReset();
    mockRunAI.mockReturnValue({
      courts: [],
      waiting: [],
      aiScore: { total: 0, balance: 0, history: 0, waiting: 0, rules: 0, policy: 0 },
      candidates: [],
      bestCandidateScore: 0,
    });

    seedStorage();
  });

  it("renders seeded players and allows search filtering", async () => {
    const user = userEvent.setup();
    render(<SelectPlayers />);

    expect(screen.getByText("An")).toBeInTheDocument();
    expect(screen.getByText("Binh")).toBeInTheDocument();

    const searchInput = screen.getByLabelText("🔍 Tìm kiếm người chơi");
    await user.type(searchInput, "Cuong");

    expect(screen.getByText("Cuong")).toBeInTheDocument();
    expect(screen.queryByText("Binh")).not.toBeInTheDocument();
  });

  it("enables start button after selecting at least 4 players and runs AI", async () => {
    const user = userEvent.setup();
    render(<SelectPlayers />);

    const startButton = screen.getByRole("button", { name: "🤖 BẮT ĐẦU XẾP" });
    expect(startButton).toBeDisabled();

    await selectFirstFourPlayers(user);

    expect(startButton).toBeEnabled();

    await user.click(startButton);

    expect(mockRunAI).toHaveBeenCalledTimes(1);

    const [playersSelected, options] = mockRunAI.mock.calls[0];
    expect(playersSelected).toHaveLength(4);
    expect(options.enabledCourts).toHaveLength(2);
  });

  it("shows readiness guidance for missing courts when players are enough", async () => {
    const user = userEvent.setup();
    render(<SelectPlayers />);

    await selectFirstFourPlayers(user);
    await user.click(screen.getAllByRole("button", { name: "Bỏ chọn tất cả" })[0]);

    expect(
      screen.getByText("Chọn tối thiểu 1 sân để bắt đầu xếp.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🤖 BẮT ĐẦU XẾP" })).toBeDisabled();
  });

  it("supports preview flow with cancel and apply actions", async () => {
    const user = userEvent.setup();

    mockRunAI.mockReturnValue(buildMockScheduleResult());

    render(<SelectPlayers />);
    await selectFirstFourPlayers(user);
    await user.click(screen.getByRole("button", { name: "🤖 BẮT ĐẦU XẾP" }));

    expect(screen.getByText("👀 Chế độ xem trước")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "❌ Hủy" }));
    expect(screen.queryByText("👀 Chế độ xem trước")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "🤖 BẮT ĐẦU XẾP" }));
    await user.click(screen.getByRole("button", { name: "✅ Áp dụng lịch xếp" }));

    expect(screen.queryByText("👀 Chế độ xem trước")).not.toBeInTheDocument();
    expect(screen.getByText("Đã áp dụng và lưu phiên xếp sân!")).toBeInTheDocument();
  });

  it("toggles player lock state and persists to director storage", async () => {
    const user = userEvent.setup();
    render(<SelectPlayers />);

    const lockButtons = screen.getAllByRole("button", { name: "Khóa" });
    await user.click(lockButtons[0]);

    expect(screen.getByRole("button", { name: "Mở khóa" })).toBeInTheDocument();

    const directorState = JSON.parse(localStorage.getItem(SCOPED_DIRECTOR_KEY));
    expect(directorState.lockedPlayers.length).toBe(1);
  });

  it("toggles court lock inside schedule result", async () => {
    const user = userEvent.setup();

    mockRunAI.mockReturnValue(buildMockScheduleResult());

    render(<SelectPlayers />);
    await selectFirstFourPlayers(user);
    await user.click(screen.getByRole("button", { name: "🤖 BẮT ĐẦU XẾP" }));

    await user.click(screen.getByRole("button", { name: "🔒 Khóa sân" }));
    expect(screen.getByRole("button", { name: "🔓 Đã khóa" })).toBeInTheDocument();

    const directorState = JSON.parse(localStorage.getItem(SCOPED_DIRECTOR_KEY));
    expect(directorState.lockedCourts).toContain(101);
  });

  it("shows over-capacity warning when selected players exceed available slots", async () => {
    const user = userEvent.setup();
    seedStorageWithPlayerCount(10);

    render(<SelectPlayers />);
    await user.click(screen.getByRole("button", { name: "Chọn tất cả" }));

    expect(screen.getByText(/Số người vượt quá sức chứa tối đa/)).toBeInTheDocument();
    expect(screen.getByText(/sẽ có 2 người chờ/)).toBeInTheDocument();
  });

  it("swaps teams and keeps team totals stable when move target is already full", async () => {
    const user = userEvent.setup();
    mockRunAI.mockReturnValue(buildMockScheduleResult());

    render(<SelectPlayers />);
    await selectFirstFourPlayers(user);
    await user.click(screen.getByRole("button", { name: "🤖 BẮT ĐẦU XẾP" }));

    expect(screen.getByText("Tổng: 6.2")).toBeInTheDocument();
    expect(screen.getByText("Tổng: 6.3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Đảo đội A/B" }));

    expect(screen.getByText("Tổng: 6.3")).toBeInTheDocument();
    expect(screen.getByText("Tổng: 6.2")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Chuyển B" })[0]);

    expect(screen.getByText("Tổng: 6.3")).toBeInTheDocument();
    expect(screen.getByText("Tổng: 6.2")).toBeInTheDocument();
  });

  it("keeps player lock state after using search filter", async () => {
    const user = userEvent.setup();
    render(<SelectPlayers />);

    await user.click(screen.getAllByRole("button", { name: "Khóa" })[0]);

    const searchInput = screen.getByLabelText("🔍 Tìm kiếm người chơi");
    await user.clear(searchInput);
    await user.type(searchInput, "An");

    expect(screen.getByText("An")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mở khóa" })).toBeInTheDocument();
  });

  it("passes locked courts and players from director state into runAI options", async () => {
    const user = userEvent.setup();

    localStorage.setItem(
      SCOPED_DIRECTOR_KEY,
      JSON.stringify({
        lockedCourts: [101],
        lockedPlayers: [1],
      })
    );

    render(<SelectPlayers />);
    await selectFirstFourPlayers(user);
    await user.click(screen.getByRole("button", { name: "🤖 BẮT ĐẦU XẾP" }));

    expect(mockRunAI).toHaveBeenCalledTimes(1);
    const [, options] = mockRunAI.mock.calls[0];
    expect(options.lockedCourts).toEqual([101]);
    expect(options.lockedPlayers).toEqual([1]);
  });

  it("shows waiting chips for both locked-by-director and normal waiting players", async () => {
    const user = userEvent.setup();

    localStorage.setItem(
      SCOPED_DIRECTOR_KEY,
      JSON.stringify({
        lockedCourts: [],
        lockedPlayers: [5],
      })
    );

    mockRunAI.mockReturnValue({
      ...buildMockScheduleResult(),
      waiting: [
        { id: 5, name: "Em", level: 2.5 },
        { id: 4, name: "Dung", level: 3.5 },
      ],
    });

    render(<SelectPlayers />);
    await selectFirstFourPlayers(user);
    await user.click(screen.getByRole("button", { name: "🤖 BẮT ĐẦU XẾP" }));

    expect(screen.getByText("Khóa bởi Director")).toBeInTheDocument();
    expect(screen.getByText("Chờ vòng này")).toBeInTheDocument();
  });

  it("renders AI score metrics and debug summary from schedule result", async () => {
    const user = userEvent.setup();

    mockRunAI.mockReturnValue({
      ...buildMockScheduleResult(),
      waiting: [
        { id: 5, name: "Em", level: 2.5 },
        { id: 4, name: "Dung", level: 3.5 },
      ],
      aiScore: {
        total: 91,
        balance: 77,
        history: 66,
        waiting: 55,
        rules: 44,
        policy: 33,
      },
      candidates: Array.from({ length: 7 }, (_, i) => ({ totalScore: 100 - i })),
      bestCandidateScore: 123,
    });

    render(<SelectPlayers />);
    await selectFirstFourPlayers(user);
    await user.click(screen.getByRole("button", { name: "🤖 BẮT ĐẦU XẾP" }));

    expect(screen.getByText("👤 Người chờ (2)")).toBeInTheDocument();

    const scorePanel = screen.getByText("🤖 Đánh giá AI").closest(".MuiCard-root");
    expect(scorePanel).not.toBeNull();

    const scope = within(scorePanel);
    expect(scope.getByText("91")).toBeInTheDocument();
    expect(scope.getByText("77")).toBeInTheDocument();
    expect(scope.getByText("66")).toBeInTheDocument();
    expect(scope.getByText("55")).toBeInTheDocument();
    expect(scope.getByText("44")).toBeInTheDocument();
    expect(scope.getByText("33")).toBeInTheDocument();
    expect(scope.getByText("123")).toBeInTheDocument();

    expect(
      scope.getByText("Sân: 1 • Người chờ: 2 • Điểm AI: 91 • Phương án: 7 • Preview")
    ).toBeInTheDocument();
  });

  it("auto-selects enough courts when pressing the 'Chọn đủ X sân' shortcut", async () => {
    const user = userEvent.setup();
    render(<SelectPlayers />);

    await selectFirstFourPlayers(user);
    await user.click(screen.getAllByRole("button", { name: "Bỏ chọn tất cả" })[0]);

    expect(screen.getByText("Đã chọn: 0 / 2 sân hoạt động")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Chọn đủ 1 sân" }));

    expect(screen.getByText("Đã chọn: 1 / 2 sân hoạt động")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🤖 BẮT ĐẦU XẾP" })).toBeEnabled();
  });

  it("disables inactive court checkbox and excludes inactive courts from runAI enabledCourts", async () => {
    const user = userEvent.setup();
    seedStorageWithInactiveCourt();

    render(<SelectPlayers />);

    expect(screen.getByText(/Sân 2 \(không hoạt động\)/)).toBeInTheDocument();

    const disabledChecks = screen
      .getAllByRole("checkbox")
      .filter((item) => item.hasAttribute("disabled"));
    expect(disabledChecks.length).toBeGreaterThan(0);

    await selectFirstFourPlayers(user);
    await user.click(screen.getByRole("button", { name: "🤖 BẮT ĐẦU XẾP" }));

    expect(mockRunAI).toHaveBeenCalledTimes(1);
    const [, options] = mockRunAI.mock.calls[0];

    expect(options.enabledCourts.map((court) => court.id)).toEqual([101, 103]);
  });

  it("supports select-all and deselect-all court actions", async () => {
    const user = userEvent.setup();
    render(<SelectPlayers />);

    expect(screen.getByText("Đã chọn: 2 / 2 sân hoạt động")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Bỏ chọn tất cả" })[0]);
    expect(screen.getByText("Đã chọn: 0 / 2 sân hoạt động")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Chọn tất cả sân" }));
    expect(screen.getByText("Đã chọn: 2 / 2 sân hoạt động")).toBeInTheDocument();
  });

  it("updates required-courts guidance as selected player count changes", async () => {
    const user = userEvent.setup();
    seedStorageWithPlayerCount(8);

    render(<SelectPlayers />);

    await user.click(screen.getByRole("button", { name: "Chọn tất cả" }));

    expect(screen.getByText("Sẵn sàng xếp sân.")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Bỏ chọn tất cả" })[0]);

    expect(
      screen.getByText("Chọn tối thiểu 1 sân để bắt đầu xếp.")
    ).toBeInTheDocument();
  });

  it("supports auto-apply mode without showing preview banner", async () => {
    const user = userEvent.setup();

    mockRunAI.mockReturnValue(buildMockScheduleResult());

    render(<SelectPlayers />);
    await selectFirstFourPlayers(user);

    await user.click(screen.getByLabelText("Chế độ xếp"));
    await user.click(screen.getByRole("option", { name: "Auto-apply" }));

    await user.click(screen.getByRole("button", { name: "🤖 BẮT ĐẦU XẾP" }));

    expect(screen.queryByText("👀 Chế độ xem trước")).not.toBeInTheDocument();
    expect(
      screen.getByText("Đã auto-apply và lưu phiên xếp sân.")
    ).toBeInTheDocument();
  });

  it("renders alternative plans and allows selecting a different AI candidate", async () => {
    const user = userEvent.setup();

    mockRunAI.mockReturnValue({
      ...buildMockScheduleResult(),
      alternatives: [
        {
          index: 0,
          totalScore: 95,
          comparison: { avgDiff: 0.2, maxDiff: 0.4, minDiff: 0.1 },
          courts: buildMockScheduleResult().courts,
        },
        {
          index: 1,
          totalScore: 92,
          comparison: { avgDiff: 0.3, maxDiff: 0.6, minDiff: 0.1 },
          courts: buildMockScheduleResult().courts,
        },
      ],
      selectedAlternativeIndex: 0,
    });

    render(<SelectPlayers />);
    await selectFirstFourPlayers(user);
    await user.click(screen.getByRole("button", { name: "🤖 BẮT ĐẦU XẾP" }));

    expect(screen.getByText("🧠 So sánh phương án AI")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đang chọn" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Chọn phương án" }));

    const selectedButtons = screen.getAllByRole("button", { name: "Đang chọn" });
    expect(selectedButtons.length).toBe(1);
  });

  it("switches active club data and resets selected players state", async () => {
    const user = userEvent.setup();
    seedStorageWithMultipleClubs();

    render(
      <>
        <ClubSwitcher />
        <SelectPlayers />
      </>
    );

    expect(screen.getByText("An Default")).toBeInTheDocument();

    await user.click(screen.getAllByRole("checkbox")[2]);
    await user.click(screen.getAllByRole("checkbox")[3]);
    await user.click(screen.getAllByRole("checkbox")[4]);
    await user.click(screen.getAllByRole("checkbox")[5]);

    expect(screen.getByRole("button", { name: "🤖 BẮT ĐẦU XẾP" })).toBeEnabled();

    await user.click(screen.getByLabelText("CLB"));
    await user.click(screen.getByRole("option", { name: "CLB B" }));

    expect(screen.getByText("Bao ClubB")).toBeInTheDocument();
    expect(screen.queryByText("An Default")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🤖 BẮT ĐẦU XẾP" })).toBeDisabled();
  });

  it("shows all competition type options in selector", async () => {
    const user = userEvent.setup();
    seedStorageWithCompetitionPlayers();

    render(<SelectPlayers />);

    await user.click(screen.getByLabelText("Loại giải"));

    expect(screen.getByRole("option", { name: "Giải Open" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Đơn nam" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Đơn nữ" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Đôi nam" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Đôi nữ" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Đôi nam nữ" })).toBeInTheDocument();
  });

  it("enforces mixed doubles gender constraints before running AI", async () => {
    const user = userEvent.setup();
    seedStorageWithCompetitionPlayers();

    render(<SelectPlayers />);

    await user.click(screen.getByLabelText("Loại giải"));
    await user.click(screen.getByRole("option", { name: "Đôi nam nữ" }));

    // Select 3 men + 1 woman (invalid for mixed doubles requirements).
    await selectFirstFourPlayers(user);

    await user.click(screen.getByRole("button", { name: "🤖 BẮT ĐẦU XẾP" }));

    expect(screen.getByText(/2 nam và 2 nữ/)).toBeInTheDocument();
    expect(mockRunAI).toHaveBeenCalledTimes(0);
  });
});
