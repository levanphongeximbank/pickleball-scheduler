import { normalizeEntries } from "../../../../models/tournament/entry.js";
import {
  FEE_MODE,
  getEntryFee,
  getEntryPayment,
  PAYMENT_STATUS,
} from "../../../individual-tournament/engines/entryFeeEngine.js";
import { eventDisplayName, isProfileComplete, resolveBatchBEvent } from "./eventScope.js";

const PAYMENT_LABEL = { paid: "Đã thanh toán", unpaid: "Chưa thanh toán", free: "Miễn phí" };
const PROFILE_LABEL = { complete: "Đủ hồ sơ", incomplete: "Thiếu hồ sơ", unknown: "Chưa có dữ liệu" };

function paymentState(tournament, entryId) {
  const fee = getEntryFee(tournament);
  if (!fee.enabled || fee.mode === FEE_MODE.FREE) {
    return { key: "free", label: PAYMENT_LABEL.free, satisfied: true };
  }
  const payment = getEntryPayment(tournament, entryId);
  const paid = payment.status === PAYMENT_STATUS.PAID || payment.status === PAYMENT_STATUS.WAIVED;
  return {
    key: paid ? "paid" : "unpaid",
    label: paid ? PAYMENT_LABEL.paid : PAYMENT_LABEL.unpaid,
    satisfied: paid,
  };
}

export function deriveParticipantsModel(tournament, { selectedEventId } = {}) {
  const scope = resolveBatchBEvent(tournament, selectedEventId);
  const event = scope.event;
  const entries = event ? normalizeEntries(event.entries) : [];
  const rows = entries.map((entry) => {
    const payment = paymentState(tournament, entry.id);
    const complete = isProfileComplete(entry, event);
    const issue = !complete
      ? "Thiếu hồ sơ"
      : !payment.satisfied
        ? "Chưa thanh toán"
        : "";
    return {
      id: entry.id,
      names: entry.name,
      payment: payment.key,
      paymentLabel: payment.label,
      paymentSatisfied: payment.satisfied,
      profile: complete ? "complete" : "incomplete",
      profileLabel: complete ? PROFILE_LABEL.complete : PROFILE_LABEL.incomplete,
      checkin: null,
      checkinLabel: "Chưa có dữ liệu",
      eligible: null,
      eligibilityLabel: "Chưa có dữ liệu",
      issue,
    };
  });

  const unpaid = rows.filter((row) => row.payment === "unpaid").length;
  const incomplete = rows.filter((row) => row.profile === "incomplete").length;
  const readyItems = [
    {
      label: "Thanh toán đủ",
      ready: unpaid === 0,
      note: unpaid ? `${unpaid} cặp chưa thanh toán` : rows.length ? "Tất cả đã thanh toán hoặc miễn phí" : "Chưa có hồ sơ",
    },
    {
      label: "Hồ sơ đủ",
      ready: incomplete === 0,
      note: incomplete ? `${incomplete} cặp thiếu hồ sơ` : rows.length ? "Tất cả đủ hồ sơ" : "Chưa có hồ sơ",
    },
    {
      label: "Check-in bắt buộc",
      ready: true,
      note: "Chưa có dữ liệu check-in — không chặn chốt danh sách",
    },
  ];
  const blockers = readyItems.filter((item) => !item.ready);

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: eventDisplayName(event),
    eventId: event?.id || "",
    needsEventChoice: scope.needsEventChoice,
    emptyEvents: scope.emptyEvents,
    events: scope.events,
    kpis: {
      total: rows.length,
      paid: rows.filter((row) => row.payment === "paid" || row.payment === "free").length,
      checkedIn: "—",
      complete: rows.filter((row) => row.profile === "complete").length,
      blocked: rows.filter((row) => Boolean(row.issue)).length,
    },
    readyItems,
    blockers,
    notReady: blockers.length > 0,
    lockEnabled: false,
    lockHint: "Chốt danh sách chưa có trên hệ thống này.",
    impactLocked: "Chốt danh sách chưa có trên hệ thống này. Không thêm hoặc khóa từ màn này.",
    impactOpen:
      "Sau khi chốt danh sách: không thêm VĐV thường. Hiện chưa có thao tác chốt riêng. Lưu hồ sơ không phải đóng đăng ký, cũng không phải chốt danh sách.",
    rows,
  };
}

export function filterParticipantRows(rows, filters = {}) {
  const query = String(filters.query || "").trim().toLowerCase();
  const payment = filters.payment || "all";
  const profile = filters.profile || "all";
  const checkin = filters.checkin || "all";
  const eligibility = filters.eligibility || "all";
  const issue = filters.issue || "all";
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const hay = `${row.names} ${row.id} ${row.issue || ""}`.toLowerCase();
    if (query && !hay.includes(query)) return false;
    if (payment !== "all") {
      if (payment === "paid" && row.payment !== "paid" && row.payment !== "free") return false;
      if (payment === "unpaid" && row.payment !== "unpaid") return false;
    }
    if (profile !== "all" && row.profile !== profile) return false;
    if (checkin === "yes" || checkin === "no") return false;
    if (eligibility === "ready" || eligibility === "blocked") return false;
    if (issue === "has" && !row.issue) return false;
    if (issue === "none" && row.issue) return false;
    return true;
  });
}
