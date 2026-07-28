import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";

import BillingAccessGate from "../../features/billing/components/BillingAccessGate.jsx";
import { useBilling } from "../../features/billing/hooks/useBilling.js";
import { listEnabledPaymentProviders } from "../../features/billing/providers/index.js";
import {
  BillingEmptyState,
  BillingLegacyBanner,
  BillingUnavailableState,
  BillingUsageUnavailableState,
} from "../../features/billing/runtime/BillingStateViews.jsx";
import { BILLING_RUNTIME_MODE } from "../../features/billing/runtime/constants.js";
import { PERMISSIONS } from "../../features/identity/constants/permissions.js";

function formatCurrency(amount, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency }).format(amount);
}

function BillingState({ access, loading }) {
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (access.lockLevel === "suspended") {
    return <Alert severity="error" sx={{ mb: 2 }}>Tenant đang bị tạm khóa. Chỉ SUPER_ADMIN có thể mở khóa.</Alert>;
  }

  if (!access.allowed) {
    return <Alert severity="warning" sx={{ mb: 2 }}>Subscription hết hạn — bạn vẫn xem được billing và có thể gia hạn.</Alert>;
  }

  return null;
}

function RecentList({ items, emptyTitle, emptyMessage, renderItem }) {
  if (!items.length) {
    return <BillingEmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return <List dense>{items.map(renderItem)}</List>;
}

const BILLING_NAV_BUTTON_SX = { width: { xs: "100%", sm: "auto" } };

export default function BillingPage({ title = "Billing", description = "Quản lý gói và thanh toán", view = "overview" }) {
  const {
    runtime,
    subscription,
    plan,
    planCatalog,
    access,
    invoices,
    payments,
    usageSummary,
    billingLoading,
    billingError,
    persistError,
    changePlan,
    createInvoice,
    recordManualPayment,
    requestCancel,
  } = useBilling();

  const providers = listEnabledPaymentProviders();
  const loading = billingLoading;
  const isUnavailable = runtime.mode === BILLING_RUNTIME_MODE.UNAVAILABLE;
  const isLegacyLocal = runtime.mode === BILLING_RUNTIME_MODE.LEGACY_LOCAL;
  const isMissingScope = runtime.mode === BILLING_RUNTIME_MODE.MISSING_SCOPE;

  return (
    <BillingAccessGate requiredPermission={PERMISSIONS.BILLING_VIEW}>
      <Box sx={{ p: 3 }}>
        {billingError && !isUnavailable && <Alert severity="error" sx={{ mb: 2 }}>{billingError}</Alert>}
        {persistError && <Alert severity="warning" sx={{ mb: 2 }}>{persistError}</Alert>}
        {isUnavailable ? <BillingUnavailableState message={runtime.message} /> : null}
        {isMissingScope ? <BillingUnavailableState title="Thiếu tenant Billing" message={runtime.message} /> : null}
        {isLegacyLocal ? <BillingLegacyBanner /> : null}
        {!isUnavailable && !isMissingScope ? <BillingState access={access} loading={loading} /> : null}

        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h5">{title}</Typography>
            <Typography color="text.secondary">
              {isLegacyLocal
                ? "Quản lý gói và thanh toán ở chế độ local/demo được gắn nhãn rõ ràng."
                : description}
            </Typography>
          </Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            <Button component={RouterLink} to="/billing" variant={view === "overview" ? "contained" : "outlined"} size="small" sx={BILLING_NAV_BUTTON_SX}>Overview</Button>
            <Button component={RouterLink} to="/billing/current-plan" variant={view === "current-plan" ? "contained" : "outlined"} size="small" sx={BILLING_NAV_BUTTON_SX}>Plan</Button>
            <Button component={RouterLink} to="/billing/usage" variant={view === "usage" ? "contained" : "outlined"} size="small" sx={BILLING_NAV_BUTTON_SX}>Usage</Button>
            <Button component={RouterLink} to="/billing/invoices" variant={view === "invoices" ? "contained" : "outlined"} size="small" sx={BILLING_NAV_BUTTON_SX}>Invoices</Button>
            <Button component={RouterLink} to="/billing/payment" variant={view === "payment" ? "contained" : "outlined"} size="small" sx={BILLING_NAV_BUTTON_SX}>Payment</Button>
            <Button component={RouterLink} to="/billing/upgrade" variant={view === "upgrade" ? "contained" : "outlined"} size="small" sx={BILLING_NAV_BUTTON_SX}>Nâng cấp gói</Button>
            <Button component={RouterLink} to="/billing/support" variant={view === "support" ? "contained" : "outlined"} size="small" sx={BILLING_NAV_BUTTON_SX}>Support</Button>
          </Stack>
        </Stack>

        {(isUnavailable || isMissingScope) && (
          <BillingEmptyState
            title="Không thể hiển thị dữ liệu Billing đáng tin cậy"
            message="Trang này đã dừng ở trạng thái cuối cùng an toàn và không tiếp tục quay vô hạn."
            actionLabel="Xem hỗ trợ"
            actionTo="/billing/support"
          />
        )}

        {!isUnavailable && !isMissingScope && (view === "overview" || view === "current-plan") && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Gói hiện tại</Typography>
                  <Typography color="text.secondary">{plan?.name || "Chưa có dữ liệu gói đáng tin cậy"}</Typography>
                  {subscription ? (
                    <Chip label={subscription.status} color={subscription.status === "active" ? "success" : "warning"} sx={{ mt: 1 }} />
                  ) : (
                    <Chip label="Chưa có subscription" variant="outlined" sx={{ mt: 1 }} />
                  )}
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    Giá tháng: {plan ? formatCurrency(plan.price_monthly || 0, plan.currency || "VND") : "—"}
                  </Typography>
                  <Typography variant="body2">Bắt đầu: {subscription?.start_date ? new Date(subscription.start_date).toLocaleDateString("vi-VN") : "—"}</Typography>
                  <Typography variant="body2">Hết hạn / trial: {subscription?.trial_end_date ? new Date(subscription.trial_end_date).toLocaleDateString("vi-VN") : "—"}</Typography>
                  {subscription?.grace_period_until && (
                    <Typography variant="body2" color="warning.main">Grace period đến: {new Date(subscription.grace_period_until).toLocaleDateString("vi-VN")}</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Trạng thái</Typography>
                  <Typography variant="body2">Lock level: {access.lockLevel || "none"}</Typography>
                  <Typography variant="body2">Lý do: {access.reason || "active"}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {!isUnavailable && !isMissingScope && view === "usage" && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6">Usage & Limits</Typography>
              {usageSummary.length === 0 ? (
                <BillingUsageUnavailableState />
              ) : (
                <List dense>
                  {usageSummary.map((row) => (
                    <ListItem key={row.resource} divider>
                      <ListItemText
                        primary={row.resource}
                        secondary={`${row.currentUsage} / ${row.maxAllowed} — ${row.allowed ? "OK" : "Vượt giới hạn"}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        )}

        {!isUnavailable && !isMissingScope && view === "invoices" && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6">Invoices</Typography>
              <RecentList
                items={invoices}
                emptyTitle="Chưa có invoice"
                emptyMessage="Billing chưa ghi nhận invoice nào cho tenant hiện tại."
                renderItem={(invoice) => (
                  <ListItem key={invoice.id} divider>
                    <ListItemText primary={invoice.invoice_number} secondary={`${invoice.status} · ${formatCurrency(invoice.total_amount, invoice.currency)}`} />
                  </ListItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        {!isUnavailable && !isMissingScope && view === "payment" && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6">Payment</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Provider khả dụng: {providers.map((p) => p.name).join(", ") || "manual"}
              </Typography>
              {isLegacyLocal ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button variant="contained" onClick={() => { recordManualPayment(plan?.price_monthly || 1000000); }}>
                    Ghi nhận thanh toán local/demo
                  </Button>
                  <Button variant="outlined" onClick={() => { createInvoice(plan?.price_monthly || 1000000); }}>
                    Tạo invoice local/demo
                  </Button>
                </Stack>
              ) : (
                <BillingEmptyState
                  title="Thanh toán tự phục vụ chưa sẵn sàng"
                  message="Không chạy thanh toán manual/mock trong chế độ Billing đáng tin cậy."
                />
              )}
              <Divider sx={{ my: 2 }} />
              <RecentList
                items={payments}
                emptyTitle="Chưa có payment"
                emptyMessage="Billing chưa ghi nhận payment nào cho tenant hiện tại."
                renderItem={(payment) => (
                  <ListItem key={payment.id} divider>
                    <ListItemText primary={payment.provider} secondary={`${payment.status} · ${formatCurrency(payment.amount, payment.currency)}`} />
                  </ListItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        {!isUnavailable && !isMissingScope && view === "upgrade" && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6">Upgrade / Downgrade</Typography>
              <Stack spacing={2} sx={{ mt: 2 }}>
                {planCatalog.map((option) => (
                  <Box key={option.code} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
                    <Typography variant="subtitle1">{option.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{option.description}</Typography>
                    <Typography variant="body2">{formatCurrency(option.price_monthly, option.currency)}</Typography>
                    <Button sx={{ mt: 1 }} variant={plan?.code === option.code ? "contained" : "outlined"} onClick={() => changePlan(option.code)}>
                      {plan?.code === option.code ? "Đang dùng" : "Đổi sang"}
                    </Button>
                  </Box>
                ))}
              </Stack>
              {!isLegacyLocal ? (
                <BillingEmptyState
                  title="Thay đổi gói chưa khả dụng"
                  message="Không thực hiện đổi gói hoặc hủy subscription giả trong môi trường này."
                />
              ) : (
                <Button sx={{ mt: 2 }} color="warning" onClick={requestCancel}>Yêu cầu hủy subscription local/demo</Button>
              )}
            </CardContent>
          </Card>
        )}

        {view === "support" && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Hỗ trợ billing: support@pickleballscheduler.com — gửi mã tenant và số invoice để được gia hạn nhanh.
          </Alert>
        )}

        {!isUnavailable && !isMissingScope && view === "overview" && (
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Invoices gần đây</Typography>
                  <RecentList
                    items={invoices.slice(0, 5)}
                    emptyTitle="Chưa có invoice gần đây"
                    emptyMessage="Danh sách invoice đang trống."
                    renderItem={(invoice) => (
                      <ListItem key={invoice.id} divider>
                        <ListItemText primary={invoice.invoice_number} secondary={invoice.status} />
                      </ListItem>
                    )}
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Payments gần đây</Typography>
                  <RecentList
                    items={payments.slice(0, 5)}
                    emptyTitle="Chưa có payment gần đây"
                    emptyMessage="Danh sách payment đang trống."
                    renderItem={(payment) => (
                      <ListItem key={payment.id} divider>
                        <ListItemText primary={payment.provider} secondary={payment.status} />
                      </ListItem>
                    )}
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>
    </BillingAccessGate>
  );
}
