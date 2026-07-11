/** Phase 42M — shared spacing & layout tokens for Club module UI. */
export const CLUB_PAGE_MAX_WIDTH = 1100;

export const clubPagePadding = { xs: 2, md: 3 };

export const clubCardSx = {
  height: "100%",
  borderRadius: 2,
  border: "1px solid",
  borderColor: "divider",
  transition: "box-shadow 0.2s ease, border-color 0.2s ease",
  "&:hover": { boxShadow: 3 },
  "&:focus-within": { borderColor: "primary.light", boxShadow: 2 },
};

export const clubRegistryPaperSx = {
  p: 2,
  mb: 2,
  borderRadius: 2,
  border: "1px solid",
  borderColor: "divider",
};
