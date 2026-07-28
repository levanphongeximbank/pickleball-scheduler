import { useAuth } from "../context/AuthContext.jsx";
import {
  resolveSelfProfileVariant,
  SELF_PROFILE_VARIANT,
} from "../features/identity/utils/selfProfileVariant.js";
import { useMyClubMembershipFromContext } from "../features/club/hooks/MyClubMembershipContext.jsx";
import MyProfilePage from "./MyProfilePage.jsx";
import AthleteSelfProfilePage from "./player/AthleteSelfProfilePage.jsx";

export default function SelfProfilePage() {
  const { user } = useAuth();
  const membership = useMyClubMembershipFromContext();

  if (resolveSelfProfileVariant(user, membership) === SELF_PROFILE_VARIANT.ATHLETE) {
    return <AthleteSelfProfilePage />;
  }

  return <MyProfilePage />;
}
