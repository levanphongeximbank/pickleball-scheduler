/**
 * Wave 3 Batch 3B — Court / Daily Operations adoption contracts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");

const HOME = "src/pages/courtManagement/CourtManagementHome.jsx";
const CALENDAR_PAGE = "src/pages/courtManagement/CourtManagementCalendarPage.jsx";
const CALENDAR_SHELL = "src/pages/courtManagement/calendar/CourtCalendarShell.jsx";
const CALENDAR_MATRIX =
  "src/pages/courtManagement/calendar/CourtCalendarWeekMatrix.jsx";
const BOOKINGS = "src/pages/courtManagement/BookingList.jsx";
const CHECKIN = "src/pages/mobile/CheckInDashboardPage.jsx";
const CHECKIN_STATUS =
  "src/features/mobile/components/CheckInStatusChip.jsx";

test("Batch 3B routes remain wired without route changes", () => {
  const router = read("src/router.jsx");
  assert.equal(router.includes('path="/court-management"'), true);
  assert.equal(router.includes('path="calendar"'), true);
  assert.equal(router.includes('path="bookings"'), true);
  assert.equal(router.includes('path="/mobile"'), true);
  assert.equal(router.includes('path="check-in"'), true);
});

test("court overview adopts shared header and preserves domain widgets", () => {
  const source = read(HOME);
  assert.equal(source.includes("AuthPageHeader"), true);
  for (const component of [
    "MyFacilityPanel",
    "LiveCourtsHero",
    "CourtStats",
    "CourtStatusBoard",
    "DirectorSuggestionPanel",
  ]) {
    assert.equal(source.includes(component), true, component);
  }
});

test("calendar adopts outer framing while WeekMatrix remains frozen", () => {
  const page = read(CALENDAR_PAGE);
  const shell = read(CALENDAR_SHELL);
  const matrix = read(CALENDAR_MATRIX);
  const digest = createHash("sha256").update(matrix).digest("hex");

  assert.equal(page.includes("AuthPageHeader"), true);
  assert.equal(page.includes("adoptAuthPatterns"), true);
  assert.equal(shell.includes("AuthFilterBar"), true);
  assert.equal(shell.includes("CourtCalendarWeekMatrix"), true);
  assert.equal(
    digest,
    "1e8ad4b79855983de6998ba3bacc2632025e4300537a0ab1912b755e070baa78"
  );
  assert.equal(matrix.includes("minWidth: 900"), true);
});

test("booking list adopts canonical composition with all eight data fields", () => {
  const source = read(BOOKINGS);
  for (const component of [
    "AuthPageHeader",
    "AuthFilterBar",
    "AuthResponsiveDataView",
    "StatusToneChip",
  ]) {
    assert.equal(source.includes(component), true, component);
  }
  for (const field of [
    '"bookingCode"',
    '"customerName"',
    '"bookingType"',
    '"courtName"',
    '"time"',
    '"totalAmount"',
    '"bookingStatus"',
    '"paymentStatus"',
  ]) {
    assert.equal(source.includes(`field: ${field}`), true, field);
  }
  for (const state of [
    "dateFilter",
    "showAllDates",
    "search",
    "typeFilter",
    "paymentFilter",
    "statusFilter",
    "sortBy",
  ]) {
    assert.equal(source.includes(state), true, state);
  }
  assert.equal(source.includes("BookingForm"), true);
  assert.equal(source.includes("BookingDetail"), true);
});

test("check-in adopts mobile-safe shared UI without changing runtime services", () => {
  const source = read(CHECKIN);
  for (const component of [
    "AuthPageHeader",
    "AuthFilterBar",
    "AuthResponsiveDataView",
    "AuthEmptyState",
    "AppSnackbar",
  ]) {
    assert.equal(source.includes(component), true, component);
  }
  for (const runtimeContract of [
    "getCheckinDashboard",
    "getOfflineSnapshotSummary",
    "flushOfflineQueue",
    "getOfflineQueueStatusSummary",
    "useOfflineStatus",
    'to="/mobile/qr-scan"',
    'to="/mobile/qr-generate"',
  ]) {
    assert.equal(source.includes(runtimeContract), true, runtimeContract);
  }
  assert.equal(source.includes("window.alert"), false);
  assert.equal(source.includes("MOBILE_PAGE_GUTTER"), false);
  assert.equal(source.includes("components/tournament"), false);
});

test("status semantics stay in domain adapters and shared layer renders tone only", () => {
  const bookingSource = read(BOOKINGS);
  const checkinStatusSource = read(CHECKIN_STATUS);
  const sharedStatusSource = read(
    "src/features/web-app-ui/StatusToneChip.jsx"
  );

  assert.equal(bookingSource.includes("getBookingDisplayStatus"), true);
  assert.equal(checkinStatusSource.includes("CHECKIN_STATUS_LABELS"), true);
  assert.equal(checkinStatusSource.includes("CHECKIN_STATUS_COLORS"), true);
  assert.equal(checkinStatusSource.includes("StatusToneChip"), true);
  assert.equal(sharedStatusSource.includes("CHECKIN_STATUS"), false);
  assert.equal(sharedStatusSource.includes("bookingStatus"), false);
});

test("Batch 3B accessibility contracts expose labels and named mobile actions", () => {
  const bookingSource = read(BOOKINGS);
  const checkinSource = read(CHECKIN);
  const header = read("src/features/web-app-ui/AuthPageHeader.jsx");

  assert.equal(header.includes('component="h1"'), true);
  assert.equal(bookingSource.includes("labelId="), true);
  assert.equal(bookingSource.includes("aria-label={`Xem chi tiết booking"), true);
  assert.equal(checkinSource.includes('aria-label="Nội dung check-in"'), true);
  assert.equal(checkinSource.includes('label="Tìm tên, SĐT hoặc mã VĐV"'), true);
});

test("Batch 3B freeze boundaries remain clean", () => {
  for (const relativePath of [
    HOME,
    CALENDAR_PAGE,
    CALENDAR_SHELL,
    BOOKINGS,
    CHECKIN,
  ]) {
    const source = read(relativePath);
    assert.equal(/from\s+["'].*public/i.test(source), false, relativePath);
    assert.equal(/Experience(Page|Status|Empty)/.test(source), false, relativePath);
    assert.equal(/Canonical(AppShell|TopBar|Sidebar)/.test(source), false, relativePath);
  }
});
