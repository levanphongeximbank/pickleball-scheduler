import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import { useTenant } from "../../context/TenantContext.jsx";
import {
  listProducts,
  createProduct,
  setProductStatus,
  seedDefaultProducts,
  listOrders,
} from "../../features/marketplace/index.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";

export default function AdminMarketplacePage() {
  const { can } = useAuth();
  const { currentTenantId, isSuperAdmin } = useTenant();
  const [tab, setTab] = useState(0);
  const [message, setMessage] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [newProduct, setNewProduct] = useState({ name: "", price: "", category: "club_management" });

  const products = useMemo(() => {
    seedDefaultProducts();
    return isSuperAdmin ? listProducts({ activeOnly: false }) : listProducts({ tenantId: currentTenantId, activeOnly: false });
  }, [currentTenantId, isSuperAdmin, refreshKey]);

  const orders = useMemo(
    () => (isSuperAdmin ? listOrders() : listOrders({ tenantId: currentTenantId })),
    [currentTenantId, isSuperAdmin, refreshKey]
  );

  if (!isSuperAdmin && !can(PERMISSIONS.MARKETPLACE_MANAGE)) {
    return <Alert severity="error">Không có quyền truy cập admin marketplace.</Alert>;
  }

  const handleCreate = () => {
    const result = createProduct({
      name: newProduct.name,
      price: Number(newProduct.price),
      category: newProduct.category,
      status: "active",
      tenantId: isSuperAdmin ? null : currentTenantId,
    });
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMessage("Đã tạo sản phẩm.");
    setNewProduct({ name: "", price: "", category: "club_management" });
    setRefreshKey((v) => v + 1);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Admin — Marketplace
      </Typography>
      {message && <Alert sx={{ mb: 2 }}>{message}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Sản phẩm" />
        <Tab label="Đơn hàng" />
      </Tabs>

      {tab === 0 && (
        <>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Tạo sản phẩm
            </Typography>
            <TextField
              label="Tên"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              sx={{ mr: 1, mb: 1 }}
            />
            <TextField
              label="Giá"
              type="number"
              value={newProduct.price}
              onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
              sx={{ mr: 1, mb: 1 }}
            />
            <Button variant="contained" onClick={handleCreate}>
              Tạo
            </Button>
          </Paper>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tên</TableCell>
                  <TableCell>Giá</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.price.toLocaleString("vi-VN")}</TableCell>
                    <TableCell>{p.status}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() => {
                          setProductStatus(p.id, p.status === "active" ? "inactive" : "active");
                          setRefreshKey((v) => v + 1);
                        }}
                      >
                        {p.status === "active" ? "Tắt" : "Bật"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {tab === 1 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Mã</TableCell>
                <TableCell>Tenant</TableCell>
                <TableCell>Số tiền</TableCell>
                <TableCell>Trạng thái</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{o.id}</TableCell>
                  <TableCell>{o.tenantId}</TableCell>
                  <TableCell>{o.totalAmount.toLocaleString("vi-VN")}</TableCell>
                  <TableCell>{o.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
