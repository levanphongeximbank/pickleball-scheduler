/**
 * Thin wrapper around existing TenantSwitcher for Figure 1 top bar composition.
 * Keeps tenant authority in the existing TenantContext.
 */
import TenantSwitcher from "../../../components/TenantSwitcher.jsx";

export default function CanonicalTenantSwitcher(props) {
  return <TenantSwitcher variant="context" size="small" minWidth={160} {...props} />;
}
