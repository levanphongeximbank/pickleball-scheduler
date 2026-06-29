import { loadClubData, saveClubData } from "./clubStorage.js";
import { downloadTextFile } from "./courtManagementSettings.js";
import { normalizeCourtManagementSettings } from "./courtManagementSettings.js";
import { normalizeBookings } from "../models/booking.js";
import { normalizeCustomers } from "../models/customer.js";

export function buildCourtManagementExport(clubId) {
  const data = loadClubData(clubId);

  return {
    type: "court-management-export",
    exportedAt: new Date().toISOString(),
    clubId,
    schemaVersion: data.schemaVersion,
    bookings: data.bookings || [],
    customers: data.customers || [],
    recurringSeries: data.recurringSeries || [],
    courtManagement: data.courtManagement || {},
  };
}

export function downloadCourtManagementExport(clubId) {
  const payload = buildCourtManagementExport(clubId);
  const filename = `quan-ly-san-${clubId}-${new Date().toISOString().slice(0, 10)}.json`;

  downloadTextFile(filename, JSON.stringify(payload, null, 2));
}

export function validateCourtManagementImportPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "File JSON không hợp lệ." };
  }

  if (payload.type !== "court-management-export") {
    return { ok: false, message: "Không đúng định dạng sao lưu quản lý sân." };
  }

  if (!Array.isArray(payload.bookings) || !Array.isArray(payload.customers)) {
    return { ok: false, message: "Thiếu dữ liệu booking hoặc khách hàng." };
  }

  return { ok: true };
}

export function summarizeCourtManagementImport(clubId, payload) {
  const validation = validateCourtManagementImportPayload(payload);

  if (!validation.ok) {
    return validation;
  }

  const data = loadClubData(clubId);
  const importedBookings = normalizeBookings(payload.bookings);
  const importedCustomers = normalizeCustomers(payload.customers);
  const importedSeries = Array.isArray(payload.recurringSeries) ? payload.recurringSeries : [];

  return {
    ok: true,
    summary: {
      exportedAt: payload.exportedAt || null,
      sourceClubId: payload.clubId || null,
      schemaVersion: payload.schemaVersion || null,
      importBookings: importedBookings.length,
      importCustomers: importedCustomers.length,
      importRecurringSeries: importedSeries.length,
      currentBookings: (data.bookings || []).length,
      currentCustomers: (data.customers || []).length,
      currentRecurringSeries: (data.recurringSeries || []).length,
    },
  };
}

export function importCourtManagementExport(clubId, payload, { mode = "replace" } = {}) {
  const validation = validateCourtManagementImportPayload(payload);

  if (!validation.ok) {
    return validation;
  }

  const data = loadClubData(clubId);
  const importedBookings = normalizeBookings(payload.bookings);
  const importedCustomers = normalizeCustomers(payload.customers);
  const importedSeries = Array.isArray(payload.recurringSeries) ? payload.recurringSeries : [];
  const importedSettings = normalizeCourtManagementSettings(payload.courtManagement || {});

  if (mode === "merge") {
    data.bookings = normalizeBookings([...(data.bookings || []), ...importedBookings]);
    data.customers = normalizeCustomers([...(data.customers || []), ...importedCustomers]);
    data.recurringSeries = [...(data.recurringSeries || []), ...importedSeries];
    data.courtManagement = {
      ...data.courtManagement,
      ...importedSettings,
    };
  } else {
    data.bookings = importedBookings;
    data.customers = importedCustomers;
    data.recurringSeries = importedSeries;
    data.courtManagement = importedSettings;
  }

  saveClubData(clubId, data);

  return {
    ok: true,
    message:
      mode === "merge"
        ? `Đã gộp ${importedBookings.length} booking và ${importedCustomers.length} khách.`
        : `Đã khôi phục ${importedBookings.length} booking và ${importedCustomers.length} khách.`,
    counts: {
      bookings: importedBookings.length,
      customers: importedCustomers.length,
    },
  };
}
