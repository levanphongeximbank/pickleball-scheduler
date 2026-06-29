import { formatCurrency } from "./courtBookingEngine.js";
import { getRemainingAmount } from "../models/booking.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildBookingReceiptHtml(booking) {
  const remaining = getRemainingAmount(booking.totalAmount, booking.paidAmount);

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Phiếu booking ${escapeHtml(booking.bookingCode)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .muted { color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    td { padding: 8px 0; border-bottom: 1px solid #eee; vertical-align: top; }
    td.label { width: 140px; color: #666; }
    .total { font-size: 18px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Phiếu đặt sân</h1>
  <div class="muted">Mã: ${escapeHtml(booking.bookingCode)}</div>
  <table>
    <tr><td class="label">Khách</td><td>${escapeHtml(booking.customerName)}${booking.customerPhone ? ` · ${escapeHtml(booking.customerPhone)}` : ""}</td></tr>
    <tr><td class="label">Sân</td><td>${escapeHtml(booking.courtName)}</td></tr>
    <tr><td class="label">Ngày</td><td>${escapeHtml(booking.date)}</td></tr>
    <tr><td class="label">Giờ</td><td>${escapeHtml(booking.startTime)} - ${escapeHtml(booking.endTime)}</td></tr>
    <tr><td class="label">Tổng tiền</td><td class="total">${formatCurrency(booking.totalAmount)} đ</td></tr>
    <tr><td class="label">Đã thu</td><td>${formatCurrency(booking.paidAmount)} đ</td></tr>
    <tr><td class="label">Còn lại</td><td>${formatCurrency(remaining)} đ</td></tr>
    ${booking.note ? `<tr><td class="label">Ghi chú</td><td>${escapeHtml(booking.note)}</td></tr>` : ""}
  </table>
  <p class="muted">In lúc ${new Date().toLocaleString("vi-VN")}</p>
</body>
</html>`;
}

export function printBookingReceipt(booking) {
  if (!booking) {
    return false;
  }

  const popup = window.open("", "_blank", "noopener,noreferrer,width=480,height=720");

  if (!popup) {
    return false;
  }

  popup.document.open();
  popup.document.write(buildBookingReceiptHtml(booking));
  popup.document.close();
  popup.focus();
  popup.print();

  return true;
}

export function buildBookingShareText(booking) {
  if (!booking) {
    return "";
  }

  const lines = [
    `Booking: ${booking.bookingCode || ""}`,
    `Khách: ${booking.customerName || ""}`,
    booking.customerPhone ? `SĐT: ${booking.customerPhone}` : null,
    `Sân: ${booking.courtName || ""}`,
    `Ngày: ${booking.date || ""}`,
    `Giờ: ${booking.startTime || ""} - ${booking.endTime || ""}`,
    `Tổng tiền: ${formatCurrency(booking.totalAmount)} đ`,
    `Đã thu: ${formatCurrency(booking.paidAmount)} đ`,
  ].filter(Boolean);

  return lines.join("\n");
}

export async function copyBookingShareText(booking) {
  const text = buildBookingShareText(booking);

  if (!text) {
    return false;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  return false;
}

export function buildWhatsAppShareUrl(booking) {
  const text = encodeURIComponent(buildBookingShareText(booking));
  const digits = String(booking?.customerPhone || "").replace(/\D/g, "");

  if (digits) {
    const normalized = digits.startsWith("84") ? digits : `84${digits.replace(/^0/, "")}`;
    return `https://wa.me/${normalized}?text=${text}`;
  }

  return `https://wa.me/?text=${text}`;
}
