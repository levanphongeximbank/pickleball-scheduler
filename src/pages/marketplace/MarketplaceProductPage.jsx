import { useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useParams } from "react-router-dom";

import { getProduct } from "../../features/marketplace/index.js";
import PermissionGate from "../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";

export default function MarketplaceProductPage() {
  const { productId } = useParams();
  const product = useMemo(() => getProduct(productId), [productId]);

  if (!product) {
    return <Alert severity="warning">Sản phẩm không tồn tại.</Alert>;
  }

  return (
    <PermissionGate permissions={[PERMISSIONS.MARKETPLACE_VIEW]}>
      <Box>
        <Button component={RouterLink} to="/marketplace" sx={{ mb: 2 }}>
          ← Marketplace
        </Button>
        <Typography variant="h5">{product.name}</Typography>
        <Chip label={product.category} sx={{ my: 1 }} />
        <Typography variant="body1" sx={{ mb: 2 }}>
          {product.description || "Chi tiết gói dịch vụ."}
        </Typography>
        <Paper sx={{ p: 2 }}>
          <Typography>Giá: {product.price.toLocaleString("vi-VN")} {product.currency}</Typography>
          <Typography>Loại: {product.billingType}</Typography>
          <Typography>Trạng thái: {product.status}</Typography>
        </Paper>
      </Box>
    </PermissionGate>
  );
}
