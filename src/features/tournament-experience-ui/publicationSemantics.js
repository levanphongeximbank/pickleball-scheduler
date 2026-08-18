/** Prototype presentation mapping only — not domain publication authority. */
export function publicationPrimaryActionLabel(status) {
  return status === "PUBLISHED" ? "Quản lý công bố" : "Công bố đăng ký";
}
