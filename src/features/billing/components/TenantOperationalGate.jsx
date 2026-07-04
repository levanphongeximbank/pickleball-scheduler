import { Alert, Box, Button, Typography } from "@mui/material";
import LockClockIcon from "@mui/icons-material/LockClock";
import { Link as RouterLink } from "react-router-dom";

import { useBilling } from "../hooks/useBilling.js";
import {
  getTenantAccessMessage,
  TENANT_ACCESS_STATUS,
} from "../services/tenantAccessResolver.js";

function resolveGateCopy({ access, check, subscription }) {
  const reason = access.reason;
  const isSuspended =
    access.lockLevel === "suspended" || reason === "subscription_suspended";

  const isNoSubscription = reason === "no_subscription";

  const isTrialExpired = reason === "trial_expired";

  let title = "Gói thuê đã hết hạn";
  if (isSuspended) {
    title = "Tài khoản/sân đang bị tạm khóa";
  } else if (isNoSubscription) {
    title = "Chưa có gói sử dụng";
  } else if (isTrialExpired) {
    title = "Gói dùng thử đã hết hạn";
  } else if (access.lockLevel === "grace") {
    title = "Gói quá hạn — đang trong thời gian ân hạn";
  }

  const reasonToStatus = {
    no_subscription: TENANT_ACCESS_STATUS.NO_SUBSCRIPTION,
    subscription_suspended: TENANT_ACCESS_STATUS.SUSPENDED,
    trial_expired: TENANT_ACCESS_STATUS.EXPIRED,
    subscription_expired: TENANT_ACCESS_STATUS.EXPIRED,
    grace_period_ended: TENANT_ACCESS_STATUS.PAST_DUE_LOCKED,
    subscription_cancelled: TENANT_ACCESS_STATUS.CANCELLED,
  };

  const detail =
    getTenantAccessMessage(reasonToStatus[reason]) ||
    access.message ||
    check.reason ||
    "Không thể thực hiện thao tác này khi subscription không còn hiệu lực.";

  const planLabel = subscription?.plan_code ? ` (${subscription.plan_code})` : "";

  return { title, detail: `${detail}${planLabel}` };
}

export default function TenantOperationalGate({ children, action = "create_booking" }) {
  const { access, tenantAccessService, tenantId, subscription, billingLoading } = useBilling();
  const check = tenantAccessService.canPerformAction({ tenantId, action });

  if (billingLoading) {
    return children;
  }

  if (access.allowed && check.allowed) {
    return children;
  }

  const { title, detail } = resolveGateCopy({ access, check, subscription });

  return (
    <Box sx={{ py: 6, textAlign: "center" }}>
      <LockClockIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
      <Typography variant="h5" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2, maxWidth: 520, mx: "auto" }}>
        {detail}
      </Typography>
      <Alert severity="info" sx={{ maxWidth: 480, mx: "auto", mb: 2 }}>
        Bạn vẫn có thể vào trang Thanh toán, xem hóa đơn và liên hệ hỗ trợ gia hạn.
      </Alert>
      <Button component={RouterLink} to="/billing" variant="contained" sx={{ mr: 1 }}>
        Đi tới Thanh toán
      </Button>
      <Button component={RouterLink} to="/billing/support" variant="outlined">
        Liên hệ hỗ trợ
      </Button>
    </Box>
  );
}
