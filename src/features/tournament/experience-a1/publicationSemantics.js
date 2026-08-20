/** Presentational CTA label only — not domain publication authority. */
export function publicationPrimaryActionLabel(status) {
  return status === "PUBLISHED" ? "Quản lý công bố" : "Công bố đăng ký";
}

/** Production has no distinct registration-publication state. */
export function hasCanonicalRegistrationPublication() {
  return false;
}

export function registrationPublicationStatusLabel() {
  return "Chưa công bố đăng ký";
}
