import { Alert, AlertTitle, Button } from "@mui/material";
import GetAppIcon from "@mui/icons-material/GetApp";

import { usePwaInstall } from "../hooks/usePwaInstall.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { buildPwaInstallBannerModel } from "../utils/pwaInstallState.js";

export default function PwaInstallPrompt() {
  const { canInstall, isInstalled, isStandalone, promptInstall } = usePwaInstall();
  const isMobile = useIsMobile();
  const banner = buildPwaInstallBannerModel({ canInstall, isInstalled, isStandalone });

  if (!isMobile || !banner.showBanner) {
    return null;
  }

  return (
    <Alert
      severity={banner.severity}
      sx={{ mb: 2, borderRadius: 2 }}
      action={
        banner.showAction ? (
          <Button
            color="inherit"
            size="small"
            startIcon={<GetAppIcon />}
            onClick={() => promptInstall()}
          >
            {banner.actionLabel}
          </Button>
        ) : null
      }
    >
      <AlertTitle>{banner.title}</AlertTitle>
      {banner.message}
    </Alert>
  );
}
