import { useMemo, useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Grid,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { useTenant } from "../../context/TenantContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import PermissionGate from "../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import {
  listProducts,
  seedDefaultProducts,
  createOrder,
} from "../../features/marketplace/index.js";
import { isMarketplaceEnabled } from "../../features/integrations/config/integrationFlags.js";
import { simulateMockPayment } from "../../features/payments/index.js";
import { usePlatformRuntime } from "../../core/platform/app/usePlatformRuntime.js";

export default function MarketplacePage() {
  const { currentTenantId } = useTenant();
  const { user } = useAuth();
  const runtime = usePlatformRuntime();
  const navigate = useNavigate();
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [accessAllowed, setAccessAllowed] = useState(true);

  useEffect(() => {
    try {
      const decision = runtime.accessService.authorize(
        {
          user_id: user?.id || "demo-user",
          tenant_id: currentTenantId || "marketplace-preview",
          role: user?.role || "USER",
        },
        { tenant_id: currentTenantId || "marketplace-preview" },
        "marketplace.purchase"
      );
      setAccessAllowed(Boolean(decision.allowed));
    } catch {
      setAccessAllowed(false);
    }
  }, [currentTenantId, runtime, user?.id, user?.role]);

  const products = useMemo(() => {
    seedDefaultProducts();
    return listProducts({ tenantId: currentTenantId, activeOnly: true });
  }, [currentTenantId, refreshKey]);

  const handleBuy = async (productId) => {
    if (!accessAllowed) {
      setError("Runtime platform chặn thao tác mua gói.");
      return;
    }
    setError(null);
    const result = await createOrder({
      tenantId: currentTenantId,
      buyerUserId: user?.id,
      productId,
      provider: "mock",
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const pay = await simulateMockPayment(result.payment.id, "success");
    if (!pay.ok) {
      setError(pay.error);
      return;
    }
    setMessage("Mua gói thành công (mock payment).");
    setRefreshKey((v) => v + 1);
  };

  if (!isMarketplaceEnabled()) {
    return (
      <Alert severity="info">
        Marketplace chưa bật. Set <code>VITE_MARKETPLACE_ENABLED=true</code> trong .env.
      </Alert>
    );
  }

  return (
    <PermissionGate permissions={[PERMISSIONS.MARKETPLACE_VIEW]}>
      <Box>
        <StackHeader navigate={navigate} />
        <Chip
          size="small"
          label={`Runtime access: ${accessAllowed ? "allowed" : "denied"}`}
          color={accessAllowed ? "success" : "warning"}
          sx={{ mb: 2 }}
        />
        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2}>
          {products.map((product) => (
            <Grid key={product.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6">{product.name}</Typography>
                  <Chip size="small" label={product.category} sx={{ my: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    {product.description || "Gói dịch vụ mở rộng"}
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    {product.price.toLocaleString("vi-VN")} {product.currency}
                  </Typography>
                  <Typography variant="caption">{product.billingType}</Typography>
                </CardContent>
                <CardActions>
                  <Button size="small" component={RouterLink} to={`/marketplace/${product.id}`}>
                    Chi tiết
                  </Button>
                  <Button size="small" variant="contained" onClick={() => handleBuy(product.id)}>
                    Mua ngay
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </PermissionGate>
  );
}

function StackHeader({ navigate }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
      <Typography variant="h5">Marketplace</Typography>
      <Button onClick={() => navigate("/marketplace/orders")}>Đơn hàng của tôi</Button>
    </Box>
  );
}
