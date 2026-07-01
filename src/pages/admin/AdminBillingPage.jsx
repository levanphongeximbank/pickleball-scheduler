import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";

import BillingAccessGate from "../../features/billing/components/BillingAccessGate.jsx";
import { useBilling } from "../../features/billing/hooks/useBilling.js";
import { PERMISSIONS } from "../../features/identity/constants/permissions.js";

export default function AdminBillingPage({ view = "overview" }) {
  const {
    subscriptionService,
    invoiceService,
    paymentService,
    store,
    planCatalog,
    billingLoading,
    billingError,
    persistError,
    suspendSubscription,
    unlockTenant,
    markInvoicePaid,
    adminChangePlan,
  } = useBilling();
  const [selectedTenantId, setSelectedTenantId] = useState(null);

  const subscriptions = useMemo(() => subscriptionService.listAll(), [subscriptionService, store]);
  const tenantId = selectedTenantId || subscriptions[0]?.tenant_id || "tenant-demo";
  const subscription = subscriptionService.getByTenant(tenantId);
  const invoices = invoiceService.listAll();
  const payments = paymentService.listAll();
  const auditLogs = store.read("billingAuditLogs") || [];

  const handleSuspend = () => {
    if (!subscription) return;
    void suspendSubscription(subscription.id);
  };

  const handleUnlock = () => {
    void unlockTenant(tenantId);
  };

  const handleMarkPaid = () => {
    const tenantInvoice = invoices.find((item) => item.tenant_id === tenantId && item.status !== "paid");
    if (!tenantInvoice) return;
    void markInvoicePaid(tenantInvoice.id, tenantId);
  };

  const handleChangePlan = (planCode) => {
    if (!subscription) return;
    void adminChangePlan(subscription.id, planCode);
  };

  return (
    <BillingAccessGate requiredPermission={PERMISSIONS.BILLING_MANAGE}>
      <Box sx={{ p: 3 }}>
        {billingError && <Alert severity="error" sx={{ mb: 2 }}>{billingError}</Alert>}
        {persistError && <Alert severity="warning" sx={{ mb: 2 }}>{persistError}</Alert>}
        {billingLoading && <Alert severity="info" sx={{ mb: 2 }}>Đang tải dữ liệu billing…</Alert>}
        <Typography variant="h5">Admin Billing</Typography>
        <Typography color="text.secondary">Quản lý tenant, plan, invoice, payment và audit.</Typography>

        <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
          <Button component={RouterLink} to="/admin/billing" variant={view === "overview" ? "contained" : "outlined"} size="small">Overview</Button>
          <Button component={RouterLink} to="/admin/billing/tenants" variant={view === "tenants" ? "contained" : "outlined"} size="small">Tenants</Button>
          <Button component={RouterLink} to="/admin/billing/plans" variant={view === "plans" ? "contained" : "outlined"} size="small">Plans</Button>
          <Button component={RouterLink} to="/admin/billing/invoices" variant={view === "invoices" ? "contained" : "outlined"} size="small">Invoices</Button>
          <Button component={RouterLink} to="/admin/billing/payments" variant={view === "payments" ? "contained" : "outlined"} size="small">Payments</Button>
          <Button component={RouterLink} to="/admin/billing/audit" variant={view === "audit" ? "contained" : "outlined"} size="small">Audit</Button>
        </Stack>

        {(view === "overview" || view === "tenants") && (
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Tenants</Typography>
                  <List dense>
                    {subscriptions.length === 0 ? (
                      <ListItem><ListItemText primary="Chưa có subscription" /></ListItem>
                    ) : (
                      subscriptions.map((item) => (
                        <ListItem key={item.id} divider button onClick={() => setSelectedTenantId(item.tenant_id)} selected={item.tenant_id === tenantId}>
                          <ListItemText primary={item.tenant_id} secondary={`${item.status} · ${item.plan_code}`} />
                        </ListItem>
                      ))
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Tenant Detail</Typography>
                  <Chip label={tenantId} sx={{ mt: 1 }} />
                  {subscription ? (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2">Status: {subscription.status}</Typography>
                      <Typography variant="body2">Plan: {subscription.plan_code}</Typography>
                      <Typography variant="body2">Auto renew: {subscription.auto_renew ? "Có" : "Không"}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                        <Button variant="outlined" color="warning" onClick={handleSuspend}>Suspend</Button>
                        <Button variant="contained" onClick={handleUnlock}>Unlock</Button>
                        <Button variant="outlined" onClick={handleMarkPaid}>Mark invoice paid</Button>
                      </Stack>
                    </Box>
                  ) : (
                    <Alert severity="info" sx={{ mt: 2 }}>Chọn tenant để quản lý.</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {view === "plans" && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6">Plans</Typography>
              {planCatalog.map((plan) => (
                <Box key={plan.code} sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                  <Typography variant="subtitle2">{plan.name} ({plan.code})</Typography>
                  <Typography variant="body2" color="text.secondary">{plan.description}</Typography>
                  {subscription && (
                    <Button size="small" sx={{ mt: 1 }} onClick={() => handleChangePlan(plan.code)}>Gán cho {tenantId}</Button>
                  )}
                </Box>
              ))}
            </CardContent>
          </Card>
        )}

        {view === "invoices" && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6">All Invoices</Typography>
              {invoices.map((item) => (
                <Typography key={item.id} variant="body2">{item.invoice_number} · {item.tenant_id} · {item.status}</Typography>
              ))}
            </CardContent>
          </Card>
        )}

        {view === "payments" && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6">All Payments</Typography>
              {payments.map((item) => (
                <Typography key={item.id} variant="body2">{item.provider} · {item.tenant_id} · {item.status}</Typography>
              ))}
            </CardContent>
          </Card>
        )}

        {view === "audit" && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6">Billing Audit</Typography>
              <List dense>
                {auditLogs.slice(-20).reverse().map((entry) => (
                  <ListItem key={entry.id} divider>
                    <ListItemText
                      primary={entry.event_type}
                      secondary={`${entry.tenant_id} · ${entry.entity_type} · ${new Date(entry.created_at).toLocaleString("vi-VN")}`}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}
      </Box>
    </BillingAccessGate>
  );
}
