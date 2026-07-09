import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";

import ReactDOM from "react-dom/client";

import App from "./App";

import { ThemeProvider } from "@mui/material/styles";
import { PlatformRuntimeProvider } from "./core/platform/app/PlatformRuntimeProvider.jsx";
import CssBaseline from "@mui/material/CssBaseline";

import theme from "./theme/theme";
import { ensureTenantBootstrap } from "./features/tenant/services/tenantService.js";
import { seedDemoDataForDev } from "./data/seedDemoData.js";
import { flushOfflineQueue } from "./features/mobile/services/offlineQueue.js";

ensureTenantBootstrap();
seedDemoDataForDev();

async function unregisterPreviewServiceWorkers() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // Best-effort: stale SW from prior preview builds can serve broken chunks.
  }
}

async function registerServiceWorker() {
  if (import.meta.env.VITE_VERCEL_PREVIEW === "true") {
    await unregisterPreviewServiceWorkers();
    return;
  }

  try {
    const { registerSW } = await import("virtual:pwa-register");
    const updateSW = registerSW({
      onNeedRefresh() {
        if (window.confirm("Có phiên bản mới. Tải lại?")) {
          updateSW(true);
        }
      },
    });
  } catch {
    // PWA plugin disabled for this build (e.g. Vercel Preview + Deployment Protection).
  }
}

void registerServiceWorker();

window.addEventListener("online", () => {
  flushOfflineQueue().catch(() => {});
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <PlatformRuntimeProvider>
      <App />
    </PlatformRuntimeProvider>
  </ThemeProvider>
);
