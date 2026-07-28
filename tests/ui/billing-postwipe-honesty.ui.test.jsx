import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import theme from "../../src/theme/theme.js";
import BillingPage from "../../src/pages/billing/BillingPage.jsx";
import {
  BILLING_LEGACY_DEMO_BANNER,
  BILLING_RUNTIME_MODE,
  BILLING_UNAVAILABLE_USER_MESSAGE,
} from "../../src/features/billing/runtime/constants.js";

const mockUseBilling = vi.fn();
const mockProviders = vi.fn(() => [{ name: "manual" }]);

vi.mock("../../src/features/billing/hooks/useBilling.js", () => ({
  useBilling: (...args) => mockUseBilling(...args),
}));

vi.mock("../../src/features/billing/providers/index.js", () => ({
  listEnabledPaymentProviders: (...args) => mockProviders(...args),
}));

vi.mock("../../src/features/billing/components/BillingAccessGate.jsx", () => ({
  default: ({ children }) => children,
}));

function renderPage(view = "overview") {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter>
        <BillingPage view={view} />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("Billing post-wipe honesty UI", () => {
  it("HC ON shows typed unavailable copy and no fake plan values", () => {
    mockUseBilling.mockReturnValue({
      runtime: { mode: BILLING_RUNTIME_MODE.UNAVAILABLE, message: BILLING_UNAVAILABLE_USER_MESSAGE },
      subscription: null,
      plan: null,
      planCatalog: [],
      access: { allowed: true, lockLevel: "none", reason: "active" },
      invoices: [],
      payments: [],
      usageSummary: [],
      billingLoading: false,
      billingError: BILLING_UNAVAILABLE_USER_MESSAGE,
      persistError: null,
      tenantId: "venue-a",
      changePlan: vi.fn(),
      createInvoice: vi.fn(),
      recordManualPayment: vi.fn(),
      requestCancel: vi.fn(),
    });

    renderPage("overview");
    expect(screen.getByText(BILLING_UNAVAILABLE_USER_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(/không thể hiển thị dữ liệu billing đáng tin cậy/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Trial$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Thanh toán manual demo/i)).not.toBeInTheDocument();
  });

  it("HC OFF legacy-local shows explicit demo banner and demo-labeled payment CTA", () => {
    mockUseBilling.mockReturnValue({
      runtime: { mode: BILLING_RUNTIME_MODE.LEGACY_LOCAL, message: BILLING_LEGACY_DEMO_BANNER },
      subscription: { id: "sub-1", status: "trialing" },
      plan: { code: "TRIAL", name: "Trial", price_monthly: 1000000, currency: "VND" },
      planCatalog: [{ code: "TRIAL", name: "Trial", price_monthly: 1000000, currency: "VND" }],
      access: { allowed: true, lockLevel: "none", reason: "active" },
      invoices: [],
      payments: [],
      usageSummary: [],
      billingLoading: false,
      billingError: null,
      persistError: null,
      tenantId: "venue-local",
      changePlan: vi.fn(),
      createInvoice: vi.fn(),
      recordManualPayment: vi.fn(),
      requestCancel: vi.fn(),
    });

    renderPage("payment");
    expect(screen.getByText(BILLING_LEGACY_DEMO_BANNER)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ghi nhận thanh toán local\/demo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tạo invoice local\/demo/i })).toBeInTheDocument();
  });
});
