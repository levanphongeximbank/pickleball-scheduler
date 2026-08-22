/**
 * Wave 4 — deterministic canonical topbar layout contracts.
 * Used by CanonicalTopBar and focused responsive tests.
 * Breakpoints align with FIGURE1_BREAKPOINTS (md=900, lg=1200).
 *
 * CanonicalTopBar runtime viewports (only): mobile | tablet | desktop.
 * Zone key `wide` is HELPER_ONLY_NON_RUNTIME_PRESET — not emitted by CanonicalTopBar.
 */

import { FIGURE1_BREAKPOINTS } from "../../../theme/figure1Tokens.js";

/** @type {ReadonlyArray<'mobile'|'tablet'|'desktop'>} */
export const CANONICAL_TOPBAR_RUNTIME_VIEWPORTS = Object.freeze(["mobile", "tablet", "desktop"]);

/**
 * Map CSS pixel width → CanonicalTopBar runtime viewport using FIGURE1 authority.
 * @param {number} widthPx
 * @returns {'mobile'|'tablet'|'desktop'}
 */
export function resolveCanonicalTopbarRuntimeViewport(widthPx) {
  const width = Number(widthPx);
  if (!Number.isFinite(width) || width <= FIGURE1_BREAKPOINTS.mobileMax) return "mobile";
  if (width <= FIGURE1_BREAKPOINTS.tabletMax) return "tablet";
  return "desktop";
}

export const CANONICAL_TOPBAR_LAYOUT = Object.freeze({
  height: 56,
  gap: Object.freeze({
    mobile: 8,
    tablet: 10,
    desktop: 12,
  }),
  zones: Object.freeze({
    context: Object.freeze({
      // Breadcrumb / page context (desktop + tablet only)
      flex: "0 1 auto",
      minWidth: 0,
      maxWidth: Object.freeze({
        tablet: 200,
        desktop: 320,
        // HELPER_ONLY_NON_RUNTIME_PRESET — not used by CanonicalTopBar
        wide: 420,
      }),
      visible: Object.freeze({
        mobile: false,
        tablet: true,
        desktop: true,
      }),
    }),
    organization: Object.freeze({
      // Tenant / organization selector (SUPER_ADMIN)
      flex: "0 1 auto",
      minWidth: 0,
      maxWidth: Object.freeze({
        tablet: 160,
        desktop: 220,
        // HELPER_ONLY_NON_RUNTIME_PRESET — not used by CanonicalTopBar
        wide: 260,
      }),
      minWidthPx: Object.freeze({
        tablet: 132,
        desktop: 160,
        // HELPER_ONLY_NON_RUNTIME_PRESET — not used by CanonicalTopBar
        wide: 180,
      }),
      visible: Object.freeze({
        mobile: false,
        tablet: true,
        desktop: true,
      }),
    }),
    search: Object.freeze({
      flex: "1 1 auto",
      minWidth: 0,
      maxWidth: Object.freeze({
        // Batch 1D: compact mobile search field (icon+input) — not a second search system.
        mobile: 132,
        tablet: 200,
        desktop: 420,
        // HELPER_ONLY_NON_RUNTIME_PRESET — not used by CanonicalTopBar
        wide: 520,
      }),
    }),
    actions: Object.freeze({
      flex: "0 0 auto",
      minWidth: "auto",
      shrink: false,
    }),
  }),
  breadcrumb: Object.freeze({
    fontSize: 13,
    noWrap: true,
    textOverflow: "ellipsis",
    overflow: "hidden",
    maxItemsDesktop: 4,
    maxItemsTablet: 2,
  }),
  overflowX: "hidden",
  whiteSpace: "nowrap",
});

/**
 * @param {'mobile'|'tablet'|'desktop'|'wide'} viewport
 * `wide` = HELPER_ONLY_NON_RUNTIME_PRESET (not a CanonicalTopBar runtime viewport).
 */
export function resolveCanonicalTopbarZoneStyles(viewport) {
  const vp = viewport === "wide" ? "wide" : viewport;
  const layout = CANONICAL_TOPBAR_LAYOUT;
  const contextVisible = layout.zones.context.visible[vp === "wide" ? "desktop" : vp];
  const orgVisible = layout.zones.organization.visible[vp === "wide" ? "desktop" : vp];

  const contextMax =
    vp === "wide"
      ? layout.zones.context.maxWidth.wide
      : vp === "desktop"
        ? layout.zones.context.maxWidth.desktop
        : layout.zones.context.maxWidth.tablet;

  const orgMax =
    vp === "wide"
      ? layout.zones.organization.maxWidth.wide
      : vp === "desktop"
        ? layout.zones.organization.maxWidth.desktop
        : layout.zones.organization.maxWidth.tablet;

  const orgMin =
    vp === "wide"
      ? layout.zones.organization.minWidthPx.wide
      : vp === "desktop"
        ? layout.zones.organization.minWidthPx.desktop
        : layout.zones.organization.minWidthPx.tablet;

  const searchMax =
    vp === "wide"
      ? layout.zones.search.maxWidth.wide
      : vp === "desktop"
        ? layout.zones.search.maxWidth.desktop
        : vp === "tablet"
          ? layout.zones.search.maxWidth.tablet
          : layout.zones.search.maxWidth.mobile;

  return Object.freeze({
    viewport: vp,
    toolbar: Object.freeze({
      overflowX: layout.overflowX,
      gap: layout.gap[vp === "wide" ? "desktop" : vp] ?? layout.gap.desktop,
      minHeight: layout.height,
      height: layout.height,
    }),
    context: Object.freeze({
      visible: Boolean(contextVisible),
      flex: layout.zones.context.flex,
      minWidth: 0,
      maxWidth: contextMax,
    }),
    organization: Object.freeze({
      visible: Boolean(orgVisible),
      flex: layout.zones.organization.flex,
      minWidth: 0,
      widthMin: orgMin,
      maxWidth: orgMax,
    }),
    search: Object.freeze({
      flex: layout.zones.search.flex,
      minWidth: 0,
      maxWidth: searchMax,
    }),
    actions: Object.freeze({
      flexShrink: 0,
    }),
    breadcrumb: Object.freeze({
      ...layout.breadcrumb,
      maxItems: vp === "tablet" ? layout.breadcrumb.maxItemsTablet : layout.breadcrumb.maxItemsDesktop,
    }),
  });
}

/**
 * Collapse middle breadcrumb items when over maxItems (keep first + last).
 * @param {Array<{id?: string, label: string, href?: string}>} items
 * @param {number} maxItems
 */
export function collapseCanonicalBreadcrumbItems(items = [], maxItems = 4) {
  if (!Array.isArray(items) || items.length <= maxItems) return items;
  if (maxItems <= 1) return items.slice(-1);
  if (maxItems === 2) {
    return [items[0], items[items.length - 1]];
  }
  const head = items[0];
  const tail = items.slice(-(maxItems - 1));
  return [
    head,
    { id: "breadcrumb-ellipsis", label: "…", href: undefined, truncated: true },
    ...tail,
  ];
}

/**
 * Assert non-overlapping flex zones for a given viewport contract.
 * Deterministic layout gate — does not require a browser.
 */
export function assertCanonicalTopbarNoOverlap(viewport) {
  const styles = resolveCanonicalTopbarZoneStyles(viewport);
  const zones = [];
  if (styles.context.visible) {
    zones.push({ id: "context", minWidth: 0, maxWidth: styles.context.maxWidth, flexShrink: 1 });
  }
  if (styles.organization.visible) {
    zones.push({
      id: "organization",
      minWidth: 0,
      maxWidth: styles.organization.maxWidth,
      flexShrink: 1,
    });
  }
  zones.push({ id: "search", minWidth: 0, maxWidth: styles.search.maxWidth, flexShrink: 1 });
  zones.push({ id: "actions", minWidth: 0, maxWidth: null, flexShrink: 0 });

  const collisions = [];
  for (const zone of zones) {
    if (zone.minWidth !== 0 && zone.id !== "actions") {
      collisions.push(`${zone.id}:minWidth-not-zero`);
    }
    if (zone.id !== "actions" && !(zone.maxWidth > 0)) {
      collisions.push(`${zone.id}:missing-maxWidth`);
    }
  }

  // Representative CSS widths per runtime class (FIGURE1). `wide` helper uses 1440 soft budget only.
  const viewportWidth =
    viewport === "mobile"
      ? 375
      : viewport === "tablet"
        ? FIGURE1_BREAKPOINTS.tabletMin
        : viewport === "desktop"
          ? FIGURE1_BREAKPOINTS.desktopMin
          : 1440;
  const claimed = zones.reduce((sum, zone) => sum + (zone.maxWidth || 96), 0);
  // Leave room for padding/gaps (~48–72px). Soft budget, not a hard pixel paint.
  if (claimed > viewportWidth - 48) {
    collisions.push(`claimed-width:${claimed}>${viewportWidth - 48}`);
  }

  return {
    ok: collisions.length === 0,
    collisions,
    styles,
    claimed,
    viewportWidth,
  };
}
