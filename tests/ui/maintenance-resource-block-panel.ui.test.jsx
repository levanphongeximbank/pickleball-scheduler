import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";

import theme from "../../src/theme/theme.js";
import { CANONICAL_RESOURCE_BLOCK_TYPE } from "../../src/features/court-resource/constants/canonicalResourceBlock.js";

const createResourceBlock = vi.fn();
const listResourceBlocks = vi.fn();
const cancelResourceBlock = vi.fn();
const rescheduleResourceBlock = vi.fn();
const transferResourceBlock = vi.fn();

vi.mock("../../src/features/court-resource/constants/canonicalResourceBlock.js", async () => {
  const actual = await vi.importActual(
    "../../src/features/court-resource/constants/canonicalResourceBlock.js"
  );
  return {
    ...actual,
    isCanonicalResourceBlocks: () => true,
  };
});

vi.mock("../../src/features/court-resource/services/courtOperationsResourceBlockApplication.js", () => ({
  createResourceBlock: (...args) => createResourceBlock(...args),
  listResourceBlocks: (...args) => listResourceBlocks(...args),
  cancelResourceBlock: (...args) => cancelResourceBlock(...args),
  rescheduleResourceBlock: (...args) => rescheduleResourceBlock(...args),
  transferResourceBlock: (...args) => transferResourceBlock(...args),
}));

vi.mock("../../src/domain/courtManagementSettings.js", () => ({
  loadCourtManagementSettings: () => ({ openHour: 6, closeHour: 22 }),
}));

vi.mock("../../src/domain/bookingService.js", () => ({
  createMaintenanceBooking: vi.fn(),
}));

import MaintenanceBookingPanel from "../../src/pages/courtManagement/MaintenanceBookingPanel.jsx";

const COURT_A = "952a6c15-a3c1-4cd4-9dee-6720bcf5e073";
const COURT_B = "65c66b97-5522-4e09-b9b0-29ec61543370";

const courts = [
  { physicalCourtId: COURT_A, name: "Sân A", number: 1 },
  { physicalCourtId: COURT_B, name: "Sân B", number: 2 },
];

function renderPanel() {
  return render(
    <ThemeProvider theme={theme}>
      <MaintenanceBookingPanel
        clubId="club-ecebf64c78f948ccb2b59842441eb26c"
        tenantId="venue-staging-a"
        courts={courts}
      />
    </ThemeProvider>
  );
}

describe("MaintenanceBookingPanel canonical resource block UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listResourceBlocks.mockResolvedValue({ ok: true, resourceBlocks: [] });
    createResourceBlock.mockResolvedValue({
      ok: true,
      resourceBlockId: "rb-1",
      resourceBlock: { resourceBlockId: "rb-1", blockType: "MAINTENANCE" },
    });
  });

  it("MAINTENANCE_UI exposes type selector and creates MAINTENANCE", async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.getByTestId("resource-block-panel")).toBeTruthy();
    expect(screen.getByTestId("resource-block-type-select")).toBeTruthy();
    expect(screen.getByText(/OPERATIONAL_BLOCK/i)).toBeTruthy();

    await user.click(screen.getByTestId("resource-block-create-button"));

    await waitFor(() => {
      expect(createResourceBlock).toHaveBeenCalled();
    });
    const arg = createResourceBlock.mock.calls[0][0];
    expect(arg.blockType).toBe(CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE);
    expect(arg.physicalCourtId).toBe(COURT_A);
    expect(arg.tenantId).toBe("venue-staging-a");
    expect(arg.forceCanonical).toBe(true);
  });

  it("OPERATIONAL_BLOCK_UI creates OPERATIONAL_BLOCK via same canonical path", async () => {
    const user = userEvent.setup();
    renderPanel();

    const typeControl = screen.getByTestId("resource-block-type-select");
    await user.click(within(typeControl).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /OPERATIONAL_BLOCK/i }));

    await user.click(screen.getByTestId("resource-block-create-button"));

    await waitFor(() => {
      expect(createResourceBlock).toHaveBeenCalled();
    });
    const arg = createResourceBlock.mock.calls.at(-1)[0];
    expect(arg.blockType).toBe(CANONICAL_RESOURCE_BLOCK_TYPE.OPERATIONAL_BLOCK);
    expect(arg.physicalCourtId).toBe(COURT_A);
  });

  it("lists active blocks and wires cancel/reschedule/transfer actions", async () => {
    listResourceBlocks.mockResolvedValue({
      ok: true,
      resourceBlocks: [
        {
          resourceBlockId: "rb-active-1",
          blockType: "OPERATIONAL_BLOCK",
          physicalCourtId: COURT_A,
          lifecycleStatus: "active",
          version: 1,
          startsAt: "2026-08-20T08:00:00.000Z",
          endsAt: "2026-08-20T10:00:00.000Z",
        },
      ],
    });
    cancelResourceBlock.mockResolvedValue({ ok: true });
    rescheduleResourceBlock.mockResolvedValue({ ok: true });
    transferResourceBlock.mockResolvedValue({ ok: true });

    const user = userEvent.setup();
    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("resource-block-row-rb-active-1")).toBeTruthy();
    });

    await user.click(screen.getByTestId("resource-block-cancel-rb-active-1"));
    await waitFor(() => {
      expect(cancelResourceBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceBlockId: "rb-active-1",
          tenantId: "venue-staging-a",
          forceCanonical: true,
        })
      );
    });
  });
});
