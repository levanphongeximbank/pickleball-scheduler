import { useAuth } from "../context/AuthContext.jsx";
import {
  resolveSelfProfileVariant,
  SELF_PROFILE_VARIANT,
} from "../features/identity/utils/selfProfileVariant.js";
import MyProfilePage from "./MyProfilePage.jsx";
import AthleteSelfProfilePage from "./player/AthleteSelfProfilePage.jsx";

export default function SelfProfilePage() {
  const { user } = useAuth();

  if (resolveSelfProfileVariant(user) === SELF_PROFILE_VARIANT.ATHLETE) {
    return <AthleteSelfProfilePage />;
  }

  return <MyProfilePage />;
}
