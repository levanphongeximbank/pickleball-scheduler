import { useEffect, useMemo, useState } from "react";
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
import { fetchSupabaseVenues } from "../../features/billing/services/billingVenueService.js";
import { PERMISSIONS } from "../../features/identity/constants/permissions.js";
import { useTenant } from "../../context/TenantContext.jsx";
import { isSupabaseBillingStore } from "../../features/billing/repositories/billingStoreRuntime.js";

export default function AdminBillingPage({ view = "overview" }) {
  const { currentTenantId } = useTenant();
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [venueTenants, setVenueTenants] = useState([]);
  const [venuesError, setVenuesError] = useState(null);

  const effectiveTenantId = selectedTenantId || currentTenantId || null;

  const {
    tenantId,
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
    createTrialSubscription,
  } = useBilling({ tenantId: effectiveTenantId });

  useEffect(() => {
    if (!isSupabaseBillingStore(store)) {
      return;
    }

    let cancelled = false;

    async function loadVenues() {
      const result = await fetchSupabaseVenues(store.client);
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setVenueTenants(result.venues);
        setVenuesError(null);
      } else {
        setVenuesError(result.error || "Không thể tải danh sách venue.");
      }
    }

    void loadVenues();

    return () => {
      cancelled = true;
    };
  }, [store]);

  const subscriptions = useMemo(() => subscriptionService.listAll(), [subscriptionService, store]);
  const subscriptionByTenant = useMemo(
    () => new Map(subscriptions.map((item) => [item.tenant_id, item])),
    [subscriptions]
  );

  const tenantOptions = useMemo(() => {
    const map = new Map();

    for (const venue of venueTenants) {
      map.set(venue.id, {
        id: venue.id,
        name: venue.name || venue.id,
        hasSubscription: subscriptionByTenant.has(venue.id),
      });
    }

    for (const sub of subscriptions) {
      if (!map.has(sub.tenant_id)) {
        map.set(sub.tenant_id, {
          id: sub.tenant_id,
          name: sub.tenant_id,
          hasSubscription: true,
        });
      }
    }

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [venueTenants, subscriptions, subscriptionByTenant]);

  useEffect(() => {
    if (selectedTenantId || !tenantOptions.length) {
      return;
    }
    setSelectedTenantId(tenantOptions[0].id);
  }, [selectedTenantId, tenantOptions]);

  const activeTenantId = tenantId || effectiveTenantId || tenantOptions[0]?.id || null;
  const subscription = activeTenantId ? subscriptionService.getByTenant(activeTenantId) : null;
  const invoices = invoiceService.listAll();
  const payments = paymentService.listAll();
  const auditLogs = store.read("billingAuditLogs") || [];

  const handleSuspend = () => {
    if (!subscription) return;
    void suspendSubscription(subscription.id);
  };

  const handleUnlock = () => {
    if (!activeTenantId) return;
    void unlockTenant(activeTenantId);
  };

  const handleMarkPaid = () => {
    const tenantInvoice = invoices.find((item) => item.tenant_id === activeTenantId && item.status !== "paid");
    if (!tenantInvoice) return;
    void markInvoicePaid(tenantInvoice.id, activeTenantId);
  };

  const handleChangePlan = (planCode) => {
    if (!subscription) return;
    void adminChangePlan(subscription.id, planCode);
  };

  const handleCreateTrial = () => {
    if (!activeTenantId) return;
    void createTrialSubscription(activeTenantId);
  };

  return (
    <BillingAccessGate requiredPermission={PERMISSIONS.BILLING_MANAGE}>
      <Box sx={{ p: 3 }}>
        {billingError && <Alert severity="error" sx={{ mb: 2 }}>{billingError}</Alert>}
        {venuesError && <Alert severity="warning" sx={{ mb: 2 }}>{venuesError}</Alert>}
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
                    {tenantOptions.length === 0 ? (
                      <ListItem><ListItemText primary="Chưa có venue/tenant trên Supabase" /></ListItem>
                    ) : (
                      tenantOptions.map((item) => (
                        <ListItem
                          key={item.id}
                          divider
                          button
                          onClick={() => setSelectedTenantId(item.id)}
                          selected={item.id === activeTenantId}
                        >
                          <ListItemText
                            primary={item.name}
                            secondary={
                              subscriptionByTenant.get(item.id)
                                ? `${subscriptionByTenant.get(item.id).status} · ${subscriptionByTenant.get(item.id).plan_code}`
                                : "Chưa có subscription"
                            }
                          />
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
                  {activeTenantId ? (
                    <Chip label={activeTenantId} sx={{ mt: 1 }} />
                  ) : (
                    <Alert severity="info" sx={{ mt: 2 }}>Chọn tenant để quản lý.</Alert>
                  )}
                  {subscription ? (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2">Status: {subscription.status}</Typography>
                      <Typography variant="body2">Plan: {subscription.plan_code}</Typography>
                      <Typography variant="body2">
                        Trial: {subscription.trial_start_date ? new Date(subscription.trial_start_date).toLocaleDateString("vi-VN") : "—"}
                        {" → "}
                        {subscription.trial_end_date ? new Date(subscription.trial_end_date).toLocaleDateString("vi-VN") : "—"}
                      </Typography>
                      <Typography variant="body2">Auto renew: {subscription.auto_renew ? "Có" : "Không"}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
                        <Button variant="outlined" color="warning" onClick={handleSuspend}>Suspend</Button>
                        <Button variant="contained" onClick={handleUnlock}>Unlock</Button>
                        <Button variant="outlined" onClick={handleMarkPaid}>Mark invoice paid</Button>
                      </Stack>
                    </Box>
                  ) : activeTenantId ? (
                    <Box sx={{ mt: 2 }}>
                      <Alert severity="info">Tenant chưa có subscription Phase 9.</Alert>
                      <Button variant="contained" sx={{ mt: 2 }} onClick={handleCreateTrial}>
                        Tạo trial subscription
                      </Button>
                    </Box>
                  ) : null}
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
                  {subscription && activeTenantId && (
                    <Button size="small" sx={{ mt: 1 }} onClick={() => handleChangePlan(plan.code)}>
                      Gán cho {activeTenantId}
                    </Button>
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
              {invoices.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Chưa có invoice</Typography>
              ) : (
                invoices.map((item) => (
                  <Typography key={item.id} variant="body2">{item.invoice_number} · {item.tenant_id} · {item.status}</Typography>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {view === "payments" && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6">All Payments</Typography>
              {payments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Chưa có payment</Typography>
              ) : (
                payments.map((item) => (
                  <Typography key={item.id} variant="body2">{item.provider} · {item.tenant_id} · {item.status}</Typography>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {view === "audit" && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6">Billing Audit</Typography>
              <List dense>
                {auditLogs.length === 0 ? (
                  <ListItem><ListItemText primary="Chưa có audit log" /></ListItem>
                ) : (
                  auditLogs.slice(-20).reverse().map((entry) => (
                    <ListItem key={entry.id} divider>
                      <ListItemText
                        primary={entry.event_type}
                        secondary={`${entry.tenant_id} · ${entry.entity_type} · ${new Date(entry.created_at).toLocaleString("vi-VN")}`}
                      />
                    </ListItem>
                  ))
                )}
              </List>
            </CardContent>
          </Card>
        )}
      </Box>
    </BillingAccessGate>
  );
}
