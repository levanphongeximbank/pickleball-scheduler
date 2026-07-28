import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import {
  BILLING_LEGACY_DEMO_BANNER,
  BILLING_UNAVAILABLE_USER_MESSAGE,
  BILLING_USAGE_UNAVAILABLE_MESSAGE,
} from "./constants.js";

export function BillingUnavailableState({
  title = "Billing chưa khả dụng",
  message = BILLING_UNAVAILABLE_USER_MESSAGE,
}) {
  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2">{message}</Typography>
    </Alert>
  );
}

export function BillingLegacyBanner({ message = BILLING_LEGACY_DEMO_BANNER }) {
  return <Alert severity="info" sx={{ mb: 2 }}>{message}</Alert>;
}

export function BillingEmptyState({
  title,
  message,
  actionLabel,
  actionTo,
}) {
  return (
    <Box
      sx={{
        mt: 2,
        p: 3,
        border: "1px dashed",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <Stack spacing={1.5} alignItems="flex-start">
        <Typography variant="subtitle1">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
        {actionLabel && actionTo ? (
          <Button component={RouterLink} to={actionTo} variant="outlined" size="small">
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}

export function BillingUsageUnavailableState() {
  return (
    <BillingEmptyState
      title="Chưa có dữ liệu usage đáng tin cậy"
      message={BILLING_USAGE_UNAVAILABLE_MESSAGE}
    />
  );
}
