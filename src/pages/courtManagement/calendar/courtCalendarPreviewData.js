import { todayIsoDate } from "../courtManagement.constants.js";

const PREVIEW_DATE = todayIsoDate();

export const PREVIEW_CLUSTERS = Object.freeze([
  { id: "cluster-main", name: "Cụm chính — Nam Long" },
  { id: "cluster-b", name: "Cụm phụ — Nam Lý" },
]);

export const PREVIEW_COURTS = Object.freeze([
  {
    id: "preview-c1",
    name: "Sân 1",
    number: 1,
    active: true,
    status: "active",
    courtType: "indoor",
    clusterId: "cluster-main",
  },
  {
    id: "preview-c2",
    name: "Sân 2",
    number: 2,
    active: true,
    status: "active",
    courtType: "outdoor",
    clusterId: "cluster-main",
  },
  {
    id: "preview-c3",
    name: "Sân 3",
    number: 3,
    active: true,
    status: "active",
    courtType: "indoor",
    clusterId: "cluster-main",
  },
  {
    id: "preview-c4",
    name: "Sân 4",
    number: 4,
    active: true,
    status: "active",
    courtType: "outdoor",
    clusterId: "cluster-main",
  },
  {
    id: "preview-c5",
    name: "Sân 5",
    number: 5,
    active: true,
    status: "maintenance",
    courtType: "indoor",
    clusterId: "cluster-b",
  },
  {
    id: "preview-c6",
    name: "Sân 6",
    number: 6,
    active: true,
    status: "active",
    courtType: "outdoor",
    clusterId: "cluster-b",
  },
]);

function booking(id, courtId, courtName, customerName, startTime, endTime, overrides = {}) {
  return {
    id,
    bookingCode: `BK-${id}`,
    courtId,
    courtName,
    customerName,
    customerPhone: "0901234567",
    customerType: "walk_in",
    bookingType: "single",
    date: PREVIEW_DATE,
    startTime,
    endTime,
    durationMinutes: 60,
    totalAmount: 200000,
    depositAmount: 50000,
    paidAmount: 50000,
    paymentStatus: "deposit_paid",
    bookingStatus: "confirmed",
    note: "",
    ...overrides,
  };
}

export const PREVIEW_BOOKINGS = Object.freeze([
  booking("b1", "preview-c1", "Sân 1", "Nguyễn Văn An", "08:00", "10:00", {
    paymentStatus: "deposit_paid",
    paidAmount: 100000,
    totalAmount: 400000,
  }),
  booking("b2", "preview-c2", "Sân 2", "Trần Thị Bình", "09:00", "10:00", {
    paymentStatus: "paid",
    paidAmount: 200000,
    totalAmount: 200000,
  }),
  booking("b3", "preview-c3", "Sân 3", "Lê Hoàng Cường", "10:00", "12:00", {
    bookingStatus: "playing",
    paymentStatus: "paid",
    paidAmount: 400000,
    totalAmount: 400000,
  }),
  booking("b4", "preview-c4", "Sân 4", "Phạm Minh Đức", "11:00", "12:00"),
  booking("b5", "preview-c1", "Sân 1", "Giải Pickle Open", "14:00", "17:00", {
    bookingType: "tournament",
    customerName: "Giải Pickle Open",
    paymentStatus: "paid",
    paidAmount: 0,
    totalAmount: 0,
  }),
  booking("b6", "preview-c2", "Sân 2", "Social Play CN", "15:00", "17:00", {
    bookingType: "social_play",
    customerName: "Social Play CN",
    paymentStatus: "unpaid",
    paidAmount: 0,
    totalAmount: 150000,
  }),
  booking("b7", "preview-c3", "Sân 3", "Võ Thị Em", "16:00", "17:00", {
    paymentStatus: "unpaid",
    paidAmount: 0,
  }),
  booking("b8", "preview-c4", "Sân 4", "Đặng Văn Phú", "17:00", "18:00", {
    paymentStatus: "paid",
    paidAmount: 200000,
    totalAmount: 200000,
  }),
  booking("b9", "preview-c6", "Sân 6", "Huỳnh Lan", "08:00", "09:00"),
  booking("b10", "preview-c6", "Sân 6", "Bùi Quốc Huy", "13:00", "15:00", {
    paymentStatus: "deposit_paid",
    paidAmount: 100000,
    totalAmount: 400000,
  }),
  booking("b11", "preview-c1", "Sân 1", "Nguyễn Tuần", "18:00", "19:00", {
    bookingType: "recurring",
    paymentStatus: "paid",
    paidAmount: 200000,
    totalAmount: 200000,
  }),
  booking("b12", "preview-c3", "Sân 3", "Khách vãng lai", "19:00", "20:00", {
    paymentStatus: "paid",
    paidAmount: 200000,
    totalAmount: 200000,
  }),
]);

export const PREVIEW_OPEN_HOUR = 6;
export const PREVIEW_CLOSE_HOUR = 22;

export function getPreviewAnchorDate() {
  return PREVIEW_DATE;
}
