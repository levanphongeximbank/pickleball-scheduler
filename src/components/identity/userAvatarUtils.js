import { getRoleLabel } from "../../auth/roles.js";

export function getUserInitials(user) {
  const name = String(user?.displayName || getRoleLabel(user?.role) || "U").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
