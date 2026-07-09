import {
  render as rtlRender,
  screen,
  within,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";

import { AuthProvider } from "../../src/context/AuthContext.jsx";
import { ClubProvider } from "../../src/context/ClubContext.jsx";
import { SeasonProvider } from "../../src/context/SeasonContext.jsx";
import { TenantProvider } from "../../src/context/TenantContext.jsx";
import { DEFAULT_CLUB, getClubDataKey } from "../../src/data/club.js";

export const CLUB_BLOB_KEY = getClubDataKey(DEFAULT_CLUB.id);

function AppProviders({ children }) {
  return (
    <AuthProvider>
      <TenantProvider>
        <ClubProvider>
          <SeasonProvider>{children}</SeasonProvider>
        </ClubProvider>
      </TenantProvider>
    </AuthProvider>
  );
}

export function render(ui, options = {}) {
  return rtlRender(ui, {
    wrapper: AppProviders,
    ...options,
  });
}

export { screen, within, fireEvent, waitFor, act };
