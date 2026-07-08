const GOOGLE_MAPS_URL_PATTERN =
  /^(https:\/\/(maps\.google\.|www\.google\.com\/maps)|geo:)/i;

export function isValidGoogleMapsUrl(url) {
  const value = String(url || "").trim();
  if (!value) {
    return true;
  }
  return GOOGLE_MAPS_URL_PATTERN.test(value);
}

export function normalizeGoogleMapsUrl(url) {
  const value = String(url || "").trim();
  if (!value) {
    return "";
  }
  return value;
}

export function openClusterInGoogleMaps(cluster) {
  const url = normalizeGoogleMapsUrl(cluster?.googleMapsUrl);
  if (!url || !isValidGoogleMapsUrl(url)) {
    return false;
  }

  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
