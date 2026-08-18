import { Alert } from "@mui/material";

import { PROTOTYPE_BANNER_TEXT } from "../copy/uiDisplayLabels.js";

export default function PrototypeBanner() {
  return (
    <Alert
      severity="info"
      sx={{ borderRadius: 0, py: 0.5, "& .MuiAlert-message": { fontSize: 12, fontWeight: 600 } }}
    >
      {PROTOTYPE_BANNER_TEXT}
    </Alert>
  );
}
