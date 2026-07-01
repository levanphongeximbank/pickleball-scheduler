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
  createApiClientWithKey,
  listApiClients,
  listApiKeys,
  listApiLogs,
  revokeApiKey,
} from "../../features/api/index.js";
import { listPaymentTransactions, listPaymentCallbacks } from "../../features/payments/index.js";
import { listWebhookEvents } from "../../features/integrations/index.js";
import { listNotificationLogs } from "../../features/notifications/index.js";

export default function AdminIntegrationMonitoringPage() {
  const { currentTenantId, isSuperAdmin } = useTenant();
  const [tab, setTab] = useState(0);
  const [clientName, setClientName] = useState("");
  const [plainKey, setPlainKey] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const tenantFilter = isSuperAdmin ? null : currentTenantId;

  const apiClients = useMemo(
    () => listApiClients({ tenantId: tenantFilter }),
    [tenantFilter, refreshKey]
  );
  const apiKeys = useMemo(
    () => listApiKeys({ tenantId: tenantFilter }),
    [tenantFilter, refreshKey]
  );
  const apiLogs = useMemo(
    () => listApiLogs({ tenantId: tenantFilter, limit: 50 }),
    [tenantFilter, refreshKey]
  );
  const payments = useMemo(
    () => listPaymentTransactions({ tenantId: tenantFilter }),
    [tenantFilter, refreshKey]
  );
  const callbacks = useMemo(() => listPaymentCallbacks({ limit: 50 }), [refreshKey]);
  const webhooks = useMemo(
    () => listWebhookEvents({ tenantId: tenantFilter, limit: 50 }),
    [tenantFilter, refreshKey]
  );
  const notifications = useMemo(
    () => listNotificationLogs({ tenantId: tenantFilter, limit: 50 }),
    [tenantFilter, refreshKey]
  );

  const handleCreateClient = async () => {
    const result = await createApiClientWithKey({
      name: clientName,
      tenantId: currentTenantId,
      scopes: ["players:read", "marketplace:read"],
    });
    if (!result.ok) return;
    setPlainKey(result.plainKey);
    setClientName("");
    setRefreshKey((v) => v + 1);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Admin — Integration Monitoring
      </Typography>

      {plainKey && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          API Key (chỉ hiện 1 lần): <code>{plainKey}</code>
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable">
        <Tab label="API Clients" />
        <Tab label="API Logs" />
        <Tab label="Payments" />
        <Tab label="Callbacks" />
        <Tab label="Webhooks" />
        <Tab label="Notifications" />
      </Tabs>

      {tab === 0 && (
        <>
          <Paper sx={{ p: 2, mb: 2 }}>
            <TextField
              label="Tên client"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              sx={{ mr: 1 }}
            />
            <Button variant="contained" onClick={handleCreateClient}>
              Tạo API client
            </Button>
          </Paper>
          <TableContainer component={Paper} sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Client</TableCell>
                  <TableCell>Tenant</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {apiClients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.tenantId}</TableCell>
                    <TableCell>{c.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Key prefix</TableCell>
                  <TableCell>Scopes</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {apiKeys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>{k.keyPrefix}</TableCell>
                    <TableCell>{(k.scopes || []).join(", ")}</TableCell>
                    <TableCell>{k.status}</TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => { revokeApiKey(k.id); setRefreshKey((v) => v + 1); }}>
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {tab === 1 && <SimpleTable rows={apiLogs} columns={["method", "path", "statusCode", "durationMs"]} />}
      {tab === 2 && <SimpleTable rows={payments} columns={["id", "provider", "amount", "status"]} />}
      {tab === 3 && <SimpleTable rows={callbacks} columns={["id", "provider", "verified", "createdAt"]} />}
      {tab === 4 && <SimpleTable rows={webhooks} columns={["provider", "eventType", "status", "createdAt"]} />}
      {tab === 5 && <SimpleTable rows={notifications} columns={["channel", "templateKey", "status", "createdAt"]} />}
    </Box>
  );
}

function SimpleTable({ rows, columns }) {
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col}>{col}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {columns.map((col) => (
                <TableCell key={col}>{String(row[col] ?? "—")}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
