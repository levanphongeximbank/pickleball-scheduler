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

export default function BillingPage({ title = "Billing", description = "Quản lý gói và thanh toán", view = "overview" }) {
  const {
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
    tenantId,
    changePlan,
    createInvoice,
    recordManualPayment,
    requestCancel,
  } = useBilling();

  const providers = listEnabledPaymentProviders();
  const loading = billingLoading || (!subscription && !billingError && Boolean(tenantId));

  return (
    <BillingAccessGate requiredPermission={PERMISSIONS.BILLING_VIEW}>
      <Box sx={{ p: 3 }}>
        {billingError && <Alert severity="error" sx={{ mb: 2 }}>{billingError}</Alert>}
        {persistError && <Alert severity="warning" sx={{ mb: 2 }}>{persistError}</Alert>}
        <BillingState access={access} loading={loading} />

        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h5">{title}</Typography>
            <Typography color="text.secondary">{description}</Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button component={RouterLink} to="/billing" variant={view === "overview" ? "contained" : "outlined"} size="small">Overview</Button>
            <Button component={RouterLink} to="/billing/current-plan" variant={view === "current-plan" ? "contained" : "outlined"} size="small">Plan</Button>
            <Button component={RouterLink} to="/billing/usage" variant={view === "usage" ? "contained" : "outlined"} size="small">Usage</Button>
            <Button component={RouterLink} to="/billing/invoices" variant={view === "invoices" ? "contained" : "outlined"} size="small">Invoices</Button>
            <Button component={RouterLink} to="/billing/payment" variant={view === "payment" ? "contained" : "outlined"} size="small">Payment</Button>
            <Button component={RouterLink} to="/billing/upgrade" variant={view === "upgrade" ? "contained" : "outlined"} size="small">Nâng cấp gói</Button>
            <Button component={RouterLink} to="/billing/support" variant={view === "support" ? "contained" : "outlined"} size="small">Support</Button>
          </Stack>
        </Stack>

        {(view === "overview" || view === "current-plan") && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Current Plan</Typography>
                  <Typography color="text.secondary">{plan?.name || "Trial"}</Typography>
                  <Chip label={subscription?.status || "trialing"} color={subscription?.status === "active" ? "success" : "warning"} sx={{ mt: 1 }} />
                  <Typography variant="body2" sx={{ mt: 2 }}>Giá tháng: {formatCurrency(plan?.price_monthly || 0, plan?.currency || "VND")}</Typography>
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

        {view === "usage" && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6">Usage & Limits</Typography>
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
            </CardContent>
          </Card>
        )}

        {view === "invoices" && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6">Invoices</Typography>
              <List dense>
                {invoices.length === 0 ? (
                  <ListItem><ListItemText primary="Chưa có invoice" /></ListItem>
                ) : (
                  invoices.map((invoice) => (
                    <ListItem key={invoice.id} divider>
                      <ListItemText primary={invoice.invoice_number} secondary={`${invoice.status} · ${formatCurrency(invoice.total_amount, invoice.currency)}`} />
                    </ListItem>
                  ))
                )}
              </List>
            </CardContent>
          </Card>
        )}

        {view === "payment" && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6">Payment</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Provider khả dụng: {providers.map((p) => p.name).join(", ") || "manual"}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={() => { recordManualPayment(plan.price_monthly || 1000000); }}>Thanh toán manual demo</Button>
                <Button variant="outlined" onClick={() => { createInvoice(plan.price_monthly || 1000000); }}>Tạo invoice</Button>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <List dense>
                {payments.length === 0 ? (
                  <ListItem><ListItemText primary="Chưa có payment" /></ListItem>
                ) : (
                  payments.map((payment) => (
                    <ListItem key={payment.id} divider>
                      <ListItemText primary={payment.provider} secondary={`${payment.status} · ${formatCurrency(payment.amount, payment.currency)}`} />
                    </ListItem>
                  ))
                )}
              </List>
            </CardContent>
          </Card>
        )}

        {view === "upgrade" && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6">Upgrade / Downgrade</Typography>
              <Stack spacing={2} sx={{ mt: 2 }}>
                {planCatalog.map((option) => (
                  <Box key={option.code} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
                    <Typography variant="subtitle1">{option.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{option.description}</Typography>
                    <Typography variant="body2">{formatCurrency(option.price_monthly, option.currency)}</Typography>
                    <Button sx={{ mt: 1 }} variant={plan.code === option.code ? "contained" : "outlined"} onClick={() => changePlan(option.code)}>
                      {plan.code === option.code ? "Đang dùng" : "Đổi sang"}
                    </Button>
                  </Box>
                ))}
              </Stack>
              <Button sx={{ mt: 2 }} color="warning" onClick={requestCancel}>Yêu cầu hủy subscription</Button>
            </CardContent>
          </Card>
        )}

        {view === "support" && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Hỗ trợ billing: support@pickleballscheduler.com — gửi mã tenant và số invoice để được gia hạn nhanh.
          </Alert>
        )}

        {view === "overview" && (
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Invoices gần đây</Typography>
                  <List dense>
                    {invoices.slice(0, 5).map((invoice) => (
                      <ListItem key={invoice.id} divider>
                        <ListItemText primary={invoice.invoice_number} secondary={invoice.status} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Payments gần đây</Typography>
                  <List dense>
                    {payments.slice(0, 5).map((payment) => (
                      <ListItem key={payment.id} divider>
                        <ListItemText primary={payment.provider} secondary={payment.status} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>
    </BillingAccessGate>
  );
}
