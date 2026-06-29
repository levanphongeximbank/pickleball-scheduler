import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";

import { useClub } from "../../context/ClubContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import PermissionGate from "../auth/PermissionGate.jsx";
import {
  assignClubToVenue,
  createVenue,
  ensureDemoVenue,
  getVenueSummaryForClub,
  getSubscriptionPlans,
  listVenues,
  DEMO_VENUE_ID,
} from "../../domain/venueService.js";
import { requestPlanUpgrade, getPaymentMode } from "../../domain/paymentService.js";
import { formatCurrency } from "../../domain/courtBookingEngine.js";

export default function VenueOnboardingPanel() {
  const { activeClub, activeClubId, refreshClubs } = useClub();
  const { rbacEnabled } = useAuth();
  const [venueName, setVenueName] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [message, setMessage] = useState(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    ensureDemoVenue();
    setRevision((value) => value + 1);
  }, []);

  const summary = useMemo(
    () => getVenueSummaryForClub(activeClubId),
    [activeClubId, revision, activeClub?.venueId]
  );

  const venues = useMemo(() => listVenues(), [revision]);
  const plans = useMemo(() => getSubscriptionPlans(), [revision]);

  const handleUpgradePlan = (planId) => {
    if (!summary.venue?.id) {
      setMessage({ type: "error", text: "CLB chưa gắn venue." });
      return;
    }

    const result = requestPlanUpgrade(summary.venue.id, planId);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    if (result.requiresRedirect && result.redirectUrl) {
      window.location.href = result.redirectUrl;
      return;
    }

    setRevision((value) => value + 1);
    setMessage({
      type: "success",
      text: `Đã nâng cấp lên gói ${result.plan.name}.`,
    });
  };

  const handleCreateVenue = () => {
    const result = createVenue(venueName);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setVenueName("");
    setRevision((value) => value + 1);
    setMessage({ type: "success", text: `Đã tạo venue ${result.venue.name}.` });
  };

  const handleAssignDemo = () => {
    ensureDemoVenue();
    const result = assignClubToVenue(activeClubId, DEMO_VENUE_ID);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    refreshClubs();
    setRevision((value) => value + 1);
    setMessage({
      type: "success",
      text: `CLB ${activeClub?.name} đã gắn venue demo.`,
    });
  };

  const handleAssignVenue = () => {
    if (!selectedVenueId) {
      setMessage({ type: "error", text: "Chọn venue trước." });
      return;
    }

    const result = assignClubToVenue(activeClubId, selectedVenueId);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    refreshClubs();
    setRevision((value) => value + 1);
    setMessage({ type: "success", text: "Đã gán CLB vào venue." });
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <BusinessIcon color="primary" />
          <Typography variant="h6" fontWeight="bold">
            Tenant / Venue
          </Typography>
        </Stack>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Box sx={{ mb: 2, p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            CLB: {activeClub?.name}
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: "wrap" }}>
            {summary.venue ? (
              <>
                <Chip size="small" label={summary.venue.name} color="primary" />
                <Chip size="small" variant="outlined" label={`ID: ${summary.venue.id}`} />
                <Chip
                  size="small"
                  variant="outlined"
                  color={summary.subscriptionActive ? "success" : "warning"}
                  label={
                    summary.subscription
                      ? `Gói ${summary.subscription.planName} · ${summary.subscription.status}`
                      : "Chưa có subscription"
                  }
                />
              </>
            ) : (
              <Chip size="small" color="warning" label="CLB chưa gắn venue" />
            )}
          </Stack>
          {!rbacEnabled && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              RBAC tắt — venue chỉ để chuẩn bị multi-tenant. Bật RBAC để kiểm tra phân quyền theo
              venue.
            </Typography>
          )}
        </Box>

        <Stack spacing={2}>
          <PermissionGate
            permissions={[PERMISSIONS.SYSTEM_VENUES_MANAGE, PERMISSIONS.VENUE_MANAGE]}
          >
            <Button variant="outlined" onClick={handleAssignDemo}>
              Gán CLB vào venue demo ({DEMO_VENUE_ID})
            </Button>
          </PermissionGate>

          <PermissionGate permission={PERMISSIONS.SYSTEM_VENUES_MANAGE}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                size="small"
                label="Tên venue mới"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                fullWidth
              />
              <Button variant="contained" onClick={handleCreateVenue} disabled={!venueName.trim()}>
                Tạo venue
              </Button>
            </Stack>
          </PermissionGate>

          <PermissionGate
            permissions={[PERMISSIONS.SYSTEM_VENUES_MANAGE, PERMISSIONS.VENUE_MANAGE, PERMISSIONS.CLUB_MANAGE]}
          >
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                select
                size="small"
                label="Gán CLB vào venue"
                value={selectedVenueId}
                onChange={(e) => setSelectedVenueId(e.target.value)}
                fullWidth
              >
                <MenuItem value="">Chọn venue…</MenuItem>
                {venues.map((venue) => (
                  <MenuItem key={venue.id} value={venue.id}>
                    {venue.name} ({venue.id})
                  </MenuItem>
                ))}
              </TextField>
              <Button variant="contained" onClick={handleAssignVenue} disabled={!selectedVenueId}>
                Gán
              </Button>
            </Stack>
          </PermissionGate>

          {summary.venue && (
            <PermissionGate
              permissions={[
                PERMISSIONS.VENUE_SUBSCRIPTION_VIEW,
                PERMISSIONS.VENUE_MANAGE,
                PERMISSIONS.SYSTEM_SUBSCRIPTIONS_MANAGE,
              ]}
            >
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  Gói thuê phần mềm ({getPaymentMode() === "stripe" ? "Stripe" : "dev"})
                </Typography>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                  {plans.map((plan) => (
                    <Card key={plan.id} variant="outlined" sx={{ flex: 1, minWidth: 160 }}>
                      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                        <Typography fontWeight={700}>{plan.name}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {plan.priceMonthly === 0
                            ? "Miễn phí"
                            : `${formatCurrency(plan.priceMonthly)}/tháng`}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          {plan.maxCourts} sân · {plan.maxClubs} CLB · {plan.maxUsers} user
                        </Typography>
                        <Button
                          size="small"
                          variant={
                            summary.subscription?.planId === plan.id ? "outlined" : "contained"
                          }
                          disabled={summary.subscription?.planId === plan.id}
                          onClick={() => handleUpgradePlan(plan.id)}
                          sx={{ mt: 1 }}
                        >
                          {summary.subscription?.planId === plan.id ? "Đang dùng" : "Chọn gói"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Box>
            </PermissionGate>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
