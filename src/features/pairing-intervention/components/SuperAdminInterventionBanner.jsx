import { Alert, Button, Chip, Stack } from "@mui/material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";

export default function SuperAdminInterventionBanner({
  onUndo,
  canUndo = false,
  message = "Chế độ can thiệp — chỉ Founder (Super Admin).",
}) {
  return (
    <Alert
      severity="warning"
      icon={<AdminPanelSettingsIcon fontSize="small" />}
      sx={{ mb: 1.5 }}
      action={
        canUndo ? (
          <Button color="inherit" size="small" onClick={onUndo}>
            Hoàn tác
          </Button>
        ) : null
      }
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Chip size="small" color="warning" label="Super Admin" />
        <span>{message}</span>
      </Stack>
    </Alert>
  );
}
