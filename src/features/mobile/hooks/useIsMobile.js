import { useMediaQuery, useTheme } from "@mui/material";

import { MOBILE_BREAKPOINT } from "../constants/mobileNav.js";

export function useIsMobile() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down(MOBILE_BREAKPOINT));
}

export function useIsTablet() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.between("sm", MOBILE_BREAKPOINT));
}
