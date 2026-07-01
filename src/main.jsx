import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import App from "./App";

import { ThemeProvider } from "@mui/material/styles";
import { PlatformRuntimeProvider } from "./core/platform/app/PlatformRuntimeProvider.jsx";
import CssBaseline from "@mui/material/CssBaseline";

import theme from "./theme/theme";
import { seedDemoDataForDev } from "./data/seedDemoData.js";
import { flushOfflineQueue } from "./features/mobile/services/offlineQueue.js";

seedDemoDataForDev();

const updateSW = registerSW({
  onNeedRefresh() {
    if (window.confirm("Có phiên bản mới. Tải lại?")) {
      updateSW(true);
    }
  },
});

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
