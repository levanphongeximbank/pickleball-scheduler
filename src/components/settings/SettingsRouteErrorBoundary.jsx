import { Component } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";

/**
 * Catches nested Settings render/import failures so the app shell stays usable.
 * Does not invent roles, permissions, or governance elevation.
 */
export default class SettingsRouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error("[SettingsRouteErrorBoundary]", error?.message || error);
    }
  }

  handleRetry = () => {
    this.setState((prev) => ({
      error: null,
      retryCount: (prev.retryCount || 0) + 1,
    }));
  };

  handleReload = () => {
    if (typeof window !== "undefined" && typeof window.location?.reload === "function") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.error) {
      return (
        <Box sx={{ p: 3 }} data-testid="settings-route-error">
          <Stack spacing={2} maxWidth={560}>
            <Typography variant="h5" fontWeight="bold">
              Không thể hiển thị Cài đặt
            </Typography>
            <Alert severity="error">
              Đã xảy ra lỗi khi tải trang Cài đặt. Dữ liệu quyền và cấu hình không bị thay đổi.
              Bạn có thể thử lại hoặc tải lại trang.
            </Alert>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                variant="contained"
                onClick={this.handleRetry}
                data-testid="settings-error-retry"
              >
                Thử lại
              </Button>
              <Button
                variant="outlined"
                onClick={this.handleReload}
                data-testid="settings-error-reload"
              >
                Tải lại trang
              </Button>
            </Stack>
          </Stack>
        </Box>
      );
    }

    return (
      <Box key={this.state.retryCount} data-testid="settings-route-ok">
        {this.props.children}
      </Box>
    );
  }
}
