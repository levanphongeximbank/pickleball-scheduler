import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes } from "react-router-dom";

import { PrototypeExperienceLayoutRoute } from "../../src/features/tournament-experience-ui/prototypeExperienceRoutes.jsx";
import { PROTOTYPE_SCREEN_CATALOG } from "../../src/features/tournament-experience-ui/prototypeScreenCatalog.js";
import { FIXTURE_EVENT_COMPLETION, FIXTURE_PUBLIC_REGISTRATION_STATE, summarizeEventCompletion } from "../../src/features/tournament-experience-ui/fixtures/opsFixture.js";
import { getFixtureTournament } from "../../src/features/tournament-experience-ui/fixtures/prototypeFixture.js";
import { publicationPrimaryActionLabel } from "../../src/features/tournament-experience-ui/publicationSemantics.js";
import { TOURNAMENT_NAV_ITEMS } from "../../src/features/tournament-experience-ui/navigation/tournamentNav.js";

function renderAt(routePath) {
  return render(
    <MemoryRouter initialEntries={[routePath]}>
      <Routes>{PrototypeExperienceLayoutRoute()}</Routes>
    </MemoryRouter>
  );
}

describe("Phase 2B full 23-screen tournament experience prototype", () => {
  it("exposes 23 catalog screens and 22 operator nav items", () => {
    expect(PROTOTYPE_SCREEN_CATALOG).toHaveLength(23);
    expect(TOURNAMENT_NAV_ITEMS.filter((item) => item.implemented)).toHaveLength(22);
  });

  it.each(PROTOTYPE_SCREEN_CATALOG)("renders Screen $id — $heading", ({ path, heading }) => {
    renderAt(path);
    expect(screen.getAllByText(heading).length).toBeGreaterThan(0);
  });

  it("keeps Screen 04 publication CTA semantics", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/registration");
    expect(screen.getByText("Quản lý công bố")).toBeTruthy();
    expect(screen.queryByText("Công bố đăng ký")).toBeNull();
    expect(publicationPrimaryActionLabel("PUBLISHED")).toBe("Quản lý công bố");
    expect(publicationPrimaryActionLabel("NOT_PUBLISHED")).toBe("Công bố đăng ký");
  });

  it("maps public registration CTA from fixture state", () => {
    expect(FIXTURE_PUBLIC_REGISTRATION_STATE).toBe("CLOSED");
    renderAt("/ux-prototype/tournament-experience/public/pick-vn-open-2026");
    expect(screen.getByText("Đã đóng đăng ký")).toBeTruthy();
    expect(screen.queryByText("Đăng ký ngay")).toBeNull();
    expect(screen.queryByLabelText("Mở menu giải đấu")).toBeNull();
  });

  it("does not collapse SAVE / LOCK / PUBLISH / COMPLETE language", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/participants");
    expect(screen.getAllByText(/Chốt danh sách/).length).toBeGreaterThan(0);
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/schedule");
    expect(screen.getAllByText("Công bố lịch").length).toBeGreaterThan(0);
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/complete");
    expect(screen.getAllByText("Hoàn tất giải đấu").length).toBeGreaterThan(0);
    expect(screen.queryByText("Complete Tournament")).toBeNull();
  });

  it("renders Screen 03 settings form and format designer tabs", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/settings");
    expect(screen.getByText("PHẠM VI GIẢI ĐẤU")).toBeTruthy();
    expect(screen.getByLabelText("Tên giải đấu")).toBeTruthy();
    expect(screen.getByLabelText("Cụm sân / Địa điểm")).toBeTruthy();
    expect(screen.getByText("Thiết kế thể thức")).toBeTruthy();
    expect(screen.getByText("Quy định")).toBeTruthy();
    expect(screen.getByText("Lệ phí & Giải thưởng")).toBeTruthy();
    expect(screen.getByText("Lịch trình")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Giải đấu" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nội dung" })).toBeTruthy();
    expect(screen.queryByText("TOURNAMENT SCOPE")).toBeNull();
    expect(screen.queryByText("Format Designer")).toBeNull();
    expect(screen.queryByText(/\bEvent\b/)).toBeNull();
  });

  it("locks in-progress nội dung competition config on Screen 03", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/settings");
    fireEvent.click(screen.getByRole("button", { name: "Nội dung" }));
    expect(screen.getByText("NỘI DUNG THI ĐẤU")).toBeTruthy();
    expect(screen.getByText("Chọn nội dung")).toBeTruthy();
    expect(screen.getByLabelText("Tên nội dung")).toBeTruthy();
    expect(screen.getByLabelText("Trạng thái nội dung")).toBeTruthy();
    expect(screen.getByText("Đang thi đấu")).toBeTruthy();
    expect(screen.getAllByText("ĐÃ KHÓA").length).toBeGreaterThan(0);
    expect(screen.getByText("Nội dung đã bắt đầu thi đấu")).toBeTruthy();
    expect(screen.getByText("Các cấu hình ảnh hưởng thi đấu đã được khóa.")).toBeTruthy();
    expect(screen.getByText(/Điều chỉnh \/ Mở lại/)).toBeTruthy();
    expect(screen.queryByText(/Correction \/ Reopen/)).toBeNull();
    expect(screen.getByRole("button", { name: "Xem cấu hình" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cập nhật thông tin" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Lưu nháp" })).toBeNull();
    expect(screen.queryByText("DRAFT")).toBeNull();
    expect(screen.queryByText("Format Designer chưa khóa")).toBeNull();
    expect(screen.queryByText(/\bEvent\b/)).toBeNull();
    expect(screen.getByLabelText("Thể thức thi đấu")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByLabelText("Cách tính điểm")).toBeDisabled();
  });

  it("renders Screen 05 fixture-driven lock readiness in Vietnamese", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/participants");
    expect(screen.getByText("Chưa sẵn sàng chốt")).toBeTruthy();
    expect(screen.getByText("CHƯA SẴN SÀNG • 2")).toBeTruthy();
    expect(screen.getByText("Bị chặn / Cần xử lý")).toBeTruthy();
    expect(screen.queryByText("Lock danh sách")).toBeNull();
    const lockButtons = screen.getAllByRole("button", { name: "Chốt danh sách" });
    expect(lockButtons.length).toBeGreaterThan(0);
    expect(lockButtons.every((button) => button.disabled)).toBe(true);
  });

  it("renders Screen 06 formation workspace with gated draw transition", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/pairs");
    expect(screen.getByText("NGỮ CẢNH HÌNH THÀNH CẶP / ĐỘI")).toBeTruthy();
    expect(screen.getByText("Chưa sẵn sàng hình thành cặp")).toBeTruthy();
    expect(screen.getByText(/CHƯA SẴN SÀNG/)).toBeTruthy();
    expect(screen.getByText("Tạo cặp (0/2)")).toBeTruthy();
    const drawButtons = screen.getAllByRole("button", { name: "Sang bốc thăm ghép" });
    expect(drawButtons.every((button) => button.disabled)).toBe(true);
  });

  it("renders Screen 07 pair draw room with shared dark shell grammar", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/pair-draw");
    expect(screen.getByText("PHÒNG BỐC THĂM")).toBeTruthy();
    expect(screen.getByText("Nhóm A")).toBeTruthy();
    expect(screen.getByText("Nhóm B")).toBeTruthy();
    expect(screen.getByText("ĐANG BỐC")).toBeTruthy();
    expect(screen.getByText("Kết quả đã bốc")).toBeTruthy();
    expect(screen.getAllByText("Điều hành").length).toBeGreaterThan(0);
    expect(screen.getByText("Trình chiếu")).toBeTruthy();
  });

  it("disables Screen 07 lock and next lifecycle while pair draw is NOT_READY", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/pair-draw");
    expect(screen.getByText(/Còn 24 cặp chưa bốc/)).toBeTruthy();
    expect(screen.queryByText("Lock kết quả bốc thăm")).toBeNull();
    const lockButtons = screen.getAllByRole("button", { name: "Khóa kết quả bốc thăm" });
    expect(lockButtons.length).toBeGreaterThan(0);
    expect(lockButtons.every((button) => button.disabled)).toBe(true);
    const next = screen.getByRole("button", { name: /Sang bốc thăm chia bảng/ });
    expect(next.disabled).toBe(true);
    expect(next.closest("a")).toBeNull();
  });

  it("disables Screen 08 lock and next lifecycle while group draw is NOT_READY", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/group-draw");
    expect(screen.getByText(/Còn 14 cặp chưa chia bảng/)).toBeTruthy();
    expect(screen.queryByText("Lock kết quả bốc thăm")).toBeNull();
    const lockButtons = screen.getAllByRole("button", { name: "Khóa kết quả bốc thăm" });
    expect(lockButtons.length).toBeGreaterThan(0);
    expect(lockButtons.every((button) => button.disabled)).toBe(true);
    const next = screen.getByRole("button", { name: /Sang vòng bảng/ });
    expect(next.disabled).toBe(true);
    expect(next.closest("a")).toBeNull();
  });

  it("renders Screen 08 group draw room as sibling dark draw room", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/group-draw");
    expect(screen.getByText("PHÒNG BỐC THĂM")).toBeTruthy();
    expect(screen.getByText("Cặp chờ bốc")).toBeTruthy();
    expect(screen.getByText("Kết quả chia bảng")).toBeTruthy();
    expect(screen.getAllByText(/Bảng A/).length).toBeGreaterThan(0);
    expect(screen.getByText("Tổng hợp hạt giống / nhóm bốc thăm")).toBeTruthy();
  });

  it("renders Screen 09 group stage as one-group operational dashboard", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/groups");
    expect(screen.getByText("TIẾN ĐỘ BẢNG")).toBeTruthy();
    expect(screen.getByText("ĐIỀU KIỆN ĐI TIẾP")).toBeTruthy();
    expect(screen.getByText("TỔNG HỢP SÂN")).toBeTruthy();
    expect(screen.getAllByText("Đã giành quyền đi tiếp").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Còn cơ hội đi tiếp").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đã bị loại").length).toBeGreaterThan(0);
  });

  it("renders Screen 10 schedule workspace with court hierarchy and gated publish", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/schedule");
    expect(screen.getByText("CỤM SÂN / ĐỊA ĐIỂM")).toBeTruthy();
    expect(screen.getByText(/4 \/ 12 sân vật lý/)).toBeTruthy();
    expect(screen.getByText("Mức sẵn sàng công bố")).toBeTruthy();
    expect(screen.getByText("Còn 2 trận chưa xếp")).toBeTruthy();
    expect(screen.getByText("Còn 3 xung đột")).toBeTruthy();
    expect(screen.queryByText("Unscheduled = 0")).toBeNull();
    expect(screen.queryByText("Conflicts resolved")).toBeNull();
    expect(screen.queryByText("Lock standings")).toBeNull();
    const publishButtons = screen.getAllByRole("button", { name: "Công bố lịch" });
    expect(publishButtons.every((button) => button.disabled)).toBe(true);
  });

  it("renders Screen 11 selected match workspace without scoring controls", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/matches");
    expect(screen.getByText("TRẬN A-18")).toBeTruthy();
    expect(screen.getByText("Minh Quân / Hoàng Nam")).toBeTruthy();
    expect(screen.getByText(/Set 1: 11.7/)).toBeTruthy();
    expect(screen.queryByText("+1")).toBeNull();
    expect(screen.queryByText("Undo scoring")).toBeNull();
    expect(screen.queryByText("Complete Match")).toBeNull();
  });

  it("renders Screen 12 standings readiness in Vietnamese lock language", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/standings");
    expect(screen.getByText("MỨC SẴN SÀNG BXH")).toBeTruthy();
    expect(screen.getByText("Chung cuộc")).toBeTruthy();
    expect(screen.queryByText("Lock standings")).toBeNull();
    const lockButtons = screen.getAllByRole("button", { name: "Khóa BXH" });
    expect(lockButtons.length).toBeGreaterThan(0);
    expect(lockButtons.every((button) => button.disabled)).toBe(true);
  });

  it("renders Screen 13 knockout as round-centric view with mini progression", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/knockout");
    expect(screen.getByText("Tất cả trận QF")).toBeTruthy();
    expect(screen.getAllByText(/QF1/).length).toBeGreaterThan(0);
    expect(screen.getByText("Tiến vào vòng sau")).toBeTruthy();
    expect(screen.getByText("SF1")).toBeTruthy();
  });

  it("renders Screen 14 full bracket with champion node", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/bracket");
    expect(screen.getByText("Sơ đồ nhánh đấu")).toBeTruthy();
    expect(screen.getByText("VÔ ĐỊCH")).toBeTruthy();
    expect(screen.getByText("R16-1")).toBeTruthy();
    expect(screen.getByText("QF2")).toBeTruthy();
    expect(screen.getByText("R32-1")).toBeTruthy();
    expect(screen.getByTestId("bracket-connector-R32-1-R32-2-R16-1")).toBeTruthy();
    expect(screen.getByTestId("bracket-connector-R32-3-R32-4-R16-2")).toBeTruthy();
    expect(screen.getByLabelText("R32-1 + R32-2 → R16-1")).toBeTruthy();
  });

  it("renders Screen 15 director live operations with canonical court status", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/director");
    expect(screen.getByText("Dải sân")).toBeTruthy();
    expect(screen.getByText("Diễn biến vận hành")).toBeTruthy();
    expect(screen.getAllByText("Cần xử lý").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ĐANG THI ĐẤU").length).toBeGreaterThan(0);
  });

  it("renders Screen 16 court board without AVAILABLE on live courts", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/courts");
    expect(screen.getAllByText("12 sân vật lý").length).toBeGreaterThan(0);
    expect(screen.getByText("Sân 1")).toBeTruthy();
    expect(screen.getByText("QF2")).toBeTruthy();
    expect(screen.getByText("Thảo KV / Quốc Khánh")).toBeTruthy();
    expect(screen.getAllByText("BẢO TRÌ").length).toBeGreaterThan(0);
    expect(screen.getByText("Hàng chờ")).toBeTruthy();
  });

  it("renders Screen 17 referee assignment board without scoring", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/referees");
    expect(screen.getByText("Bảng phân công trọng tài")).toBeTruthy();
    expect(screen.getByText("Trận chưa có trọng tài")).toBeTruthy();
    expect(screen.getByText("Trọng tài Hùng")).toBeTruthy();
    expect(screen.queryByText("+1")).toBeNull();
  });

  it("renders Screen 18 exception workspace with selected incident", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/exceptions");
    expect(screen.getByText("Danh sách sự cố")).toBeTruthy();
    expect(screen.getByText("SỰ CỐ INC-11")).toBeTruthy();
    expect(screen.getAllByText("Trận A-19 thiếu trọng tài").length).toBeGreaterThan(0);
  });

  it("renders Screen 19 communications workspace with composer and history", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/communications");
    expect(screen.getByText("Soạn thông báo")).toBeTruthy();
    expect(screen.getByText("Lịch sử gửi")).toBeTruthy();
    expect(screen.getAllByText("Nhắc check-in").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/PICK_VN App/).length).toBeGreaterThan(0);
  });

  it("renders Screen 20 presentation control center distinct from communications", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/media");
    expect(screen.getByText("Danh mục nội dung trình chiếu")).toBeTruthy();
    expect(screen.getByText("Xem trước trình chiếu đang chọn")).toBeTruthy();
    expect(screen.getByText("Màn bốc thăm")).toBeTruthy();
    expect(screen.getAllByText("Tỷ số trực tiếp").length).toBeGreaterThan(0);
    expect(screen.getByText("LED Sân 1")).toBeTruthy();
    expect(screen.getByText("OBS / Ngữ cảnh phát sóng")).toBeTruthy();
    expect(screen.getAllByText("Luân phiên nhà tài trợ").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Bắt đầu trình chiếu" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Tạm dừng" }).disabled).toBe(false);
    expect(screen.getByTestId("presentation-live-score").textContent).toBe("11-7, 8-11, 6-4");
    expect(screen.queryByText("Composer")).toBeNull();
  });

  it("renders Screen 21 awards podium with Vietnamese readiness mapping", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/awards");
    expect(screen.getByText("VÔ ĐỊCH")).toBeTruthy();
    expect(screen.getByText("Á QUÂN")).toBeTruthy();
    expect(screen.getByText("HẠNG BA")).toBeTruthy();
    expect(screen.getByText("MVP")).toBeTruthy();
    expect(screen.getByText("Giải Fair Play")).toBeTruthy();
    expect(screen.getByText("Trận đấu ấn tượng")).toBeTruthy();
    expect(screen.getByText("Hạt giống số 1")).toBeTruthy();
    expect(screen.getByText("VĐV / Cặp tiến bộ nổi bật")).toBeTruthy();
    expect(screen.queryByText("Công bố awards")).toBeNull();
    const confirm = screen.getAllByRole("button", { name: "Xác nhận kết quả cuối" });
    const publish = screen.getAllByRole("button", { name: "Công bố giải thưởng" });
    expect(confirm.every((button) => button.disabled)).toBe(true);
    expect(publish.every((button) => button.disabled)).toBe(true);
    expect(screen.getAllByRole("button", { name: "Xem trước" }).length).toBeGreaterThan(0);
  });

  it("renders Screen 22 tournament close workspace without delete language", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/complete");
    expect(screen.getByText("Ma trận hoàn tất nội dung")).toBeTruthy();
    expect(screen.getByText("Đôi nam 3.5")).toBeTruthy();
    expect(screen.getByText("Mixed Open")).toBeTruthy();
    expect(screen.getByText("108 trận còn lại")).toBeTruthy();
    expect(screen.getByText("160/268")).toBeTruthy();
    expect(screen.getByText("Mức sẵn sàng hoàn tất giải đấu")).toBeTruthy();
    expect(screen.queryByText("Complete Tournament")).toBeNull();
    const complete = screen.getAllByRole("button", { name: "Hoàn tất giải đấu" });
    expect(complete.every((button) => button.disabled)).toBe(true);
    const close = summarizeEventCompletion(FIXTURE_EVENT_COMPLETION);
    const tournament = getFixtureTournament();
    expect(close.totalMatches).toBe(tournament.matches);
    expect(close.terminalMatches).toBe(tournament.completedMatches);
    expect(close.remainingMatches).toBe(tournament.matches - tournament.completedMatches);
    expect(close.completedEvents).toBe(2);
    expect(close.activeEventCount).toBe(3);
  });
});
