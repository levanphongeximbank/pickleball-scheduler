import { useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { useTenant } from "../../context/TenantContext.jsx";
import { listOrders } from "../../features/marketplace/index.js";
import PermissionGate from "../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";

const STATUS_COLOR = {
  pending: "warning",
  paid: "success",
  failed: "error",
  cancelled: "default",
  refunded: "info",
};

export default function MarketplaceOrdersPage() {
  const { currentTenantId } = useTenant();
  const orders = useMemo(
    () => listOrders({ tenantId: currentTenantId }),
    [currentTenantId]
  );

  return (
    <PermissionGate permissions={[PERMISSIONS.MARKETPLACE_VIEW]}>
      <Box>
        <Button component={RouterLink} to="/marketplace" sx={{ mb: 2 }}>
          ← Marketplace
        </Button>
        <Typography variant="h5" gutterBottom>
          Đơn hàng
        </Typography>

        {orders.length === 0 ? (
          <Alert severity="info">Chưa có đơn hàng.</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Mã</TableCell>
                  <TableCell>Số tiền</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell>Provider</TableCell>
                  <TableCell>Ngày</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{order.id}</TableCell>
                    <TableCell>
                      {order.totalAmount.toLocaleString("vi-VN")} {order.currency}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={order.status} color={STATUS_COLOR[order.status]} />
                    </TableCell>
                    <TableCell>{order.paymentProvider || "—"}</TableCell>
                    <TableCell>{new Date(order.createdAt).toLocaleString("vi-VN")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </PermissionGate>
  );
}
