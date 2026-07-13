import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import RealtimeConnectionStatus from "../../src/features/team-tournament/ui/RealtimeConnectionStatus.jsx";
import { TT_REALTIME_CONNECTION } from "../../src/features/team-tournament/realtime/realtimeConnectionState.js";

describe("RealtimeConnectionStatus", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_TT_REALTIME_ENABLED", "true");
  });

  it("shows degraded banner in Vietnamese", () => {
    render(
      <RealtimeConnectionStatus
        variant="banner"
        connectionState={TT_REALTIME_CONNECTION.DEGRADED}
        isRealtime={false}
        isDegraded
        pollingFallbackActive={false}
      />
    );
    expect(screen.getByTestId("tt-realtime-connection-banner")).toBeTruthy();
    expect(screen.getByText(/đồng bộ dự phòng/i)).toBeTruthy();
  });

  it("hides chip when connected and showWhenConnected false", () => {
    const { container } = render(
      <RealtimeConnectionStatus
        variant="chip"
        connectionState={TT_REALTIME_CONNECTION.CONNECTED}
        isRealtime
        isDegraded={false}
        pollingFallbackActive={false}
      />
    );
    expect(container.querySelector('[data-testid="tt-realtime-connection-status"]')).toBeNull();
  });

  it("shows chip when showWhenConnected", () => {
    render(
      <RealtimeConnectionStatus
        variant="chip"
        showWhenConnected
        connectionState={TT_REALTIME_CONNECTION.CONNECTED}
        isRealtime
        isDegraded={false}
        pollingFallbackActive={false}
      />
    );
    expect(screen.getByTestId("tt-realtime-connection-status")).toBeTruthy();
  });
});
