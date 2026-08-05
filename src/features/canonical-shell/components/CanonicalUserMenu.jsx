/**
 * Thin wrapper around existing AccountMenu for Figure 1 top bar composition.
 */
import AccountMenu from "../../../components/shell/AccountMenu.jsx";

export default function CanonicalUserMenu(props) {
  return <AccountMenu variant="light" {...props} />;
}
