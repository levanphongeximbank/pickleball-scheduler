import { ENTRY_STATUS, ENTRY_STATUS_LABELS } from "../../../../models/tournament/constants.js";
import { normalizeEntries } from "../../../../models/tournament/entry.js";
import {
  FEE_MODE,
  getEntryFee,
  getEntryPayment,
  PAYMENT_STATUS,
} from "../../../individual-tournament/engines/entryFeeEngine.js";
import {
  countApprovedEntries,
  countActiveRegistrations,
  getRegistrationSettings,
  isRegistrationLocked,
} from "../../../individual-tournament/engines/registrationEngine.js";
import { isOfficialOpenFamily } from "../deriveOverview.js";
import {
  hasCanonicalRegistrationPublication,
  publicationPrimaryActionLabel,
  registrationPublicationStatusLabel,
  resolveRegistrationPublicationStatus,
} from "../publicationSemantics.js";
import { eventDisplayName, formatViDateTime, isProfileComplete, resolveBatchBEvent } from "./eventScope.js";

const STATUS_META = {
  confirmed: { tone: "success", label: "Đã xác nhận" },
  pending: { tone: "warning", label: "Chờ duyệt" },
  waitlist: { tone: "info", label: "Danh sách chờ" },
  missing: { tone: "danger", label: "Thiếu thông tin" },
};

function paymentDisplay(tournament, entryId) {
  const fee = getEntryFee(tournament);
  if (!fee.enabled || fee.mode === FEE_MODE.FREE) {
    return { key: "free", label: "Miễn phí" };
  }
  const payment = getEntryPayment(tournament, entryId);
  if (payment.status === PAYMENT_STATUS.PAID || payment.status === PAYMENT_STATUS.WAIVED) {
    return { key: "paid", label: "Đã thanh toán" };
  }
  if (payment.status === PAYMENT_STATUS.PARTIAL) {
    return { key: "unpaid", label: "Thanh toán một phần" };
  }
  return { key: "unpaid", label: "Chưa thanh toán" };
}

function classifyRow(entry, event) {
  if (entry.status === ENTRY_STATUS.WAITLISTED) return "waitlist";
  if (entry.status === ENTRY_STATUS.PENDING) return "pending";
  if (!isProfileComplete(entry, event)) return "missing";
  if (entry.status === ENTRY_STATUS.APPROVED || entry.status === ENTRY_STATUS.ACTIVE) return "confirmed";
  return "other";
}

function statusMeta(tabStatus, entry) {
  if (STATUS_META[tabStatus]) return STATUS_META[tabStatus];
  return {
    tone: "draft",
    label: ENTRY_STATUS_LABELS[entry.status] || "Hồ sơ giải",
  };
}

export function deriveRegistrationModel(tournament, { selectedEventId, publicHref = "" } = {}) {
  const scope = resolveBatchBEvent(tournament, selectedEventId);
  const settings = getRegistrationSettings(tournament);
  const official = isOfficialOpenFamily(tournament);
  const publicationStatus = resolveRegistrationPublicationStatus(tournament);
  const published = hasCanonicalRegistrationPublication(tournament);
  const locked = isRegistrationLocked(tournament);
  const event = scope.event;
  const entries = event ? normalizeEntries(event.entries) : [];
  const rows = entries.map((entry) => {
    const tabStatus = classifyRow(entry, event);
    const status = statusMeta(tabStatus, entry);
    const payment = paymentDisplay(tournament, entry.id);
    const pending = entry.status === ENTRY_STATUS.PENDING;
    const canApprove = official && pending && Boolean(event?.id);
    return {
      id: entry.id,
      names: entry.name,
      phone: String(entry.phone || entry.contactPhone || entry.phoneNumber || "").trim() || "—",
      source: "Hồ sơ giải",
      time: formatViDateTime(entry.registeredAt) || "—",
      tabStatus,
      statusLabel: status.label,
      statusTone: status.tone,
      paymentLabel: payment.label,
      checkinLabel: "Chưa có dữ liệu",
      actionLabel: pending ? "Duyệt" : "Xem",
      actionEnabled: canApprove || !pending,
      actionHint: canApprove
        ? "Duyệt qua registrationEngine.gatedApproveEntry."
        : pending
          ? "Duyệt trên trang đăng ký VĐV hiện có."
          : "Mở trang đăng ký VĐV hiện có.",
      approveEnabled: canApprove,
    };
  });

  const confirmed = rows.filter((row) => row.tabStatus === "confirmed").length;
  const pending = rows.filter((row) => row.tabStatus === "pending").length;
  const waitlist = rows.filter((row) => row.tabStatus === "waitlist").length;
  const missing = rows.filter((row) => row.tabStatus === "missing").length;
  const maxEntries = settings.maxEntries;
  const approvedCount = event ? countApprovedEntries(event) : 0;
  const activeCount = event ? countActiveRegistrations(event) : 0;
  const pct = (count) => {
    if (!maxEntries) return activeCount ? `${count}/${activeCount}` : "—";
    return `${Math.round((count / maxEntries) * 1000) / 10}%`;
  };

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: eventDisplayName(event),
    eventId: event?.id || "",
    needsEventChoice: scope.needsEventChoice,
    emptyEvents: scope.emptyEvents,
    events: scope.events,
    official,
    publicationStatus,
    publicationStatusLabel: registrationPublicationStatusLabel(tournament),
    publicationActionLabel: publicationPrimaryActionLabel(published ? "PUBLISHED" : ""),
    publicationEnabled: official && !locked,
    publicationHint: official
      ? published
        ? locked
          ? "Đăng ký đã khóa trên hồ sơ giải."
          : "Đã công bố — có thể quản lý cửa sổ / đóng đăng ký."
        : "Công bố = chuyển trạng thái giải sang Đang đăng ký (setTournamentStatus / update)."
      : "Chưa có quyền công bố đăng ký riêng.",
    kpis: {
      maxSlots: maxEntries == null ? "—" : String(maxEntries),
      maxHint: maxEntries == null ? "Không giới hạn" : "Tối đa",
      confirmed,
      confirmedHint: pct(confirmed),
      pending,
      pendingHint: pct(pending),
      waitlist,
      waitlistHint: pct(waitlist),
    },
    window: {
      opensAt: formatViDateTime(settings.opensAt) || "Chưa cấu hình",
      closesAt: formatViDateTime(settings.closesAt) || "Chưa cấu hình",
      maxEntries: maxEntries == null ? "Không giới hạn" : String(maxEntries),
      opensAtRaw: settings.opensAt || "",
      closesAtRaw: settings.closesAt || "",
      maxEntriesRaw: settings.maxEntries ?? "",
    },
    publicHref,
    channels: [
      { label: "Dashboard PICK_VN", ready: false, note: "Chưa cấu hình từ màn này" },
      { label: "Website PICK_VN", ready: false, note: "Chưa cấu hình từ màn này" },
      {
        label: "Trang giải đấu công khai",
        ready: Boolean(publicHref),
        note: publicHref ? "Có trang công khai" : "Chưa có",
      },
    ],
    closeReadiness: [
      {
        label: "Đủ suất hợp lệ",
        ready: maxEntries == null ? activeCount >= 0 : approvedCount <= maxEntries,
        note:
          maxEntries == null
            ? "Không giới hạn suất"
            : `${approvedCount}/${maxEntries} suất đã duyệt`,
      },
      {
        label: "Đã công bố public",
        ready: published,
        note: published ? "Đã công bố trên hồ sơ giải" : "Chưa công bố đăng ký",
      },
      {
        label: missing ? `${missing} hồ sơ thiếu thông tin — chưa sẵn sàng khóa` : "Hồ sơ đủ thông tin",
        ready: missing === 0,
        note: missing ? `${missing} hồ sơ thiếu thông tin` : "Không hồ sơ thiếu thông tin",
      },
    ],
    closeEnabled: official && published && !locked,
    closeHint: official
      ? locked
        ? "Đăng ký đã khóa."
        : "Đóng đăng ký = lockRegistration (khóa + READY khi draft/registration)."
      : "Đóng đăng ký trên màn này chưa tách khỏi chốt danh sách.",
    tabs: [
      { id: "all", label: `Tất cả (${rows.length})` },
      { id: "confirmed", label: `Đã xác nhận (${confirmed})` },
      { id: "pending", label: `Chờ duyệt (${pending})` },
      { id: "waitlist", label: `Danh sách chờ (${waitlist})` },
    ],
    rows,
  };
}

export function filterRegistrationRows(rows, { tab = "all", query = "" } = {}) {
  const q = query.trim().toLowerCase();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (tab !== "all" && row.tabStatus !== tab) return false;
    if (!q) return true;
    const hay = `${row.names} ${row.id} ${row.phone}`.toLowerCase();
    return hay.includes(q);
  });
}
