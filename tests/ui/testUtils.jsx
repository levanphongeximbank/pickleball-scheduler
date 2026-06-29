import {
  render as rtlRender,
  screen,
  within,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";

import { ClubProvider } from "../../src/context/ClubContext.jsx";
import { SeasonProvider } from "../../src/context/SeasonContext.jsx";
import { DEFAULT_CLUB } from "../../src/data/club.js";

export const SCOPED_DIRECTOR_KEY = `pickleball-director::${DEFAULT_CLUB.id}`;

function AppProviders({ children }) {
  return (
    <ClubProvider>
      <SeasonProvider>{children}</SeasonProvider>
    </ClubProvider>
  );
}

export function render(ui, options = {}) {
  return rtlRender(ui, {
    wrapper: AppProviders,
    ...options,
  });
}

export { screen, within, fireEvent, waitFor, act };
