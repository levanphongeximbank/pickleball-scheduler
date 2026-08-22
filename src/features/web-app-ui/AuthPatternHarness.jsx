/**
 * AuthPatternHarness — isolated composition harness for Batch 2D evidence.
 * Not a business page. Used by UI tests / manual visual checks.
 *
 * @ownership AUTHENTICATED_SHARED
 */

import { useState } from "react";
import { Box, Button, MenuItem, TextField, Typography } from "@mui/material";

import AppSnackbar from "./AppSnackbar.jsx";
import AuthConfirmDialog from "./AuthConfirmDialog.jsx";
import AuthEmptyState from "./AuthEmptyState.jsx";
import AuthErrorState from "./AuthErrorState.jsx";
import AuthFilterBar from "./AuthFilterBar.jsx";
import AuthLoadingState from "./AuthLoadingState.jsx";
import AuthPageHeader from "./AuthPageHeader.jsx";
import AuthResponsiveDataView from "./AuthResponsiveDataView.jsx";
import StatusToneChip from "./StatusToneChip.jsx";

const SAMPLE_ROWS = [
  { id: "1", name: "Nguyen A", status: "active" },
  { id: "2", name: "Tran B", status: "pending" },
];

const SAMPLE_COLUMNS = [
  { field: "name", headerName: "Ten" },
  {
    field: "status",
    headerName: "Trang thai",
    render: (row) => (
      <StatusToneChip
        tone={row.status === "active" ? "success" : "warning"}
        label={row.status === "active" ? "Hoat dong" : "Cho duyet"}
      />
    ),
  },
];

export default function AuthPatternHarness() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);

  return (
    <Box data-testid="auth-pattern-harness" sx={{ p: 2, maxWidth: 960, mx: "auto" }}>
      <Typography variant="overline" color="text.secondary">
        Batch 2D pattern harness
      </Typography>

      <AuthPageHeader
        title="Mau trang xac thuc"
        subtitle="Chi dung cho kiem chung composition Layer 2."
        breadcrumbs={[{ label: "Trang chu", href: "/" }, { label: "Mau 2D" }]}
        status={<StatusToneChip tone="info" label="Demo" />}
        primaryAction={
          <Button variant="contained" onClick={() => setSnackOpen(true)}>
            Luu
          </Button>
        }
        secondaryActions={
          <Button variant="outlined" color="error" onClick={() => setConfirmOpen(true)}>
            Xoa
          </Button>
        }
      />

      <AuthFilterBar
        search={<TextField size="small" label="Tim kiem" fullWidth />}
        filters={
          <TextField size="small" label="Trang thai" select defaultValue="all" sx={{ minWidth: 140 }}>
            <MenuItem value="all">Tat ca</MenuItem>
          </TextField>
        }
        resultCount={2}
        resetAction={
          <Button size="small" variant="text">
            Dat lai
          </Button>
        }
      />

      <AuthResponsiveDataView
        columns={SAMPLE_COLUMNS}
        rows={SAMPLE_ROWS}
        getRowId={(row) => row.id}
      />

      <Box sx={{ mt: 3, display: "grid", gap: 2 }}>
        <AuthEmptyState
          title="Chua co muc nao"
          description="Domain cung cap copy — khong hardcode nghiep vu."
        />
        <AuthLoadingState />
        <AuthErrorState message="Khong tai duoc du lieu mau." onRetry={() => {}} />
      </Box>

      <AuthConfirmDialog
        open={confirmOpen}
        title="Xoa muc nay?"
        message="Hanh dong khong the hoan tac."
        confirmTone="destructive"
        confirmLabel="Xoa"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
      />

      <AppSnackbar
        open={snackOpen}
        message="Da luu thanh cong"
        tone="success"
        onClose={() => setSnackOpen(false)}
      />
    </Box>
  );
}
