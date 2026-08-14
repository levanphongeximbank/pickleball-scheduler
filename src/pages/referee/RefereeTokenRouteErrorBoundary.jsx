import { Component } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";

export const REFEREE_TOKEN_ROUTE_ERROR_COPY =
  "Không thể mở màn hình chấm trận. Vui lòng tải lại hoặc liên hệ BTC.";

/**
 * Route-level fallback for /referee/:token. Does not replace token/CAS authority.
 */
export default class RefereeTokenRouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error("[RefereeTokenRouteErrorBoundary]", error?.message || error);
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
        <Box sx={{ p: 3 }} data-testid="referee-token-route-error">
          <Stack spacing={2} maxWidth={560}>
            <Typography variant="h5" fontWeight="bold">
              Chấm trận
            </Typography>
            <Alert severity="error">{REFEREE_TOKEN_ROUTE_ERROR_COPY}</Alert>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button variant="contained" onClick={this.handleRetry}>
                Thử lại
              </Button>
              <Button variant="outlined" onClick={this.handleReload}>
                Tải lại trang
              </Button>
            </Stack>
          </Stack>
        </Box>
      );
    }

    return (
      <Box key={this.state.retryCount} data-testid="referee-token-route-ok">
        {this.props.children}
      </Box>
    );
  }
}
