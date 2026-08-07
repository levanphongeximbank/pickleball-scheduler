/**
 * Thin wrapper around existing TenantSwitcher for Figure 1 top bar composition.
 * Wave 4: passes bounded min/max widths so organization selector cannot collide
 * with breadcrumbs or search.
 */
import TenantSwitcher from "../../../components/TenantSwitcher.jsx";

export default function CanonicalTenantSwitcher({ minWidth = 160, maxWidth = 220, ...props }) {
  return (
    <TenantSwitcher
      variant="context"
      size="small"
      minWidth={minWidth}
      maxWidth={maxWidth}
      {...props}
    />
  );
}
