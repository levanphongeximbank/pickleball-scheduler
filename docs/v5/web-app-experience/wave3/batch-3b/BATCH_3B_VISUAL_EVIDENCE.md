# Batch 3B — Visual evidence

## Method

`scripts/capture-wave3-batch3b-evidence.mjs` mounts the production Batch 3B page components with deterministic court fixtures and the canonical theme/providers. It captures the required screenshots and measures document/body overflow at 1440, 1024, 430 and 390 pixels.

Machine-readable evidence: `BATCH_3B_VISUAL_EVIDENCE.json`.

## Required screenshots

### Court management

- `screenshots/court-management-1440.png`
- `screenshots/court-management-430.png`

### Bookings

- `screenshots/bookings-1440.png`
- `screenshots/bookings-430.png`

### Calendar

- `screenshots/calendar-1440.png`
- `screenshots/calendar-430.png`

### Mobile check-in

- `screenshots/mobile-check-in-430.png`
- `screenshots/mobile-check-in-390.png`

## Responsive result

- 16 checks: four scoped views × 1440/1024/430/390.
- Exactly one authenticated page header and one `h1` were present in every check.
- Booking filter controls collapse to a single narrow-screen column.
- Calendar controls and legend wrap without page overflow.
- Check-in actions, KPIs, filters, tabs and empty state remain usable at 430 and 390.
- `NEW_HORIZONTAL_PAGE_OVERFLOW_COUNT=0`.

The week matrix was not altered or clipped. Its known local `minWidth: 900` behavior remains `W6-PAGE-001=REMAINS_WAVE6`.
