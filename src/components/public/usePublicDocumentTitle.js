/**
 * Page-local document title for Public Portal surfaces (EC-02).
 * Does not touch router, index.html, Helmet, or global head managers.
 */

import { useEffect } from "react";

const DEFAULT_BRAND = "PICK_VN";

/**
 * @param {string} title
 * @param {{ brand?: string }} [options]
 */
export function usePublicDocumentTitle(title, options = {}) {
  const brand = String(options.brand || DEFAULT_BRAND).trim() || DEFAULT_BRAND;
  const pageTitle = String(title || "").trim();

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const previous = document.title;
    document.title = pageTitle ? `${pageTitle} · ${brand}` : brand;

    return () => {
      document.title = previous;
    };
  }, [pageTitle, brand]);
}

export default usePublicDocumentTitle;
