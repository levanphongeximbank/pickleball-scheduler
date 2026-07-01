import { PERMISSIONS } from "../auth/permissions.js";
import { guardPermission } from "../auth/guardAction.js";
import { isRbacEnabled } from "../auth/authService.js";
import { ROLES, isValidRole } from "../auth/roles.js";
import { createUserRecord, USER_STATUS } from "../models/user.js";
import { loadStaffForVenue, saveStaffForVenue } from "../data/staff.js";
import { guardMaxUsers } from "../auth/subscriptionGuard.js";
import { upsertProfileRow } from "../auth/profileService.js";
import { hasSupabaseConfig } from "../auth/supabaseClient.js";

const INVITABLE_ROLES = Object.freeze([
  ROLES.COURT_MANAGER,
  ROLES.VENUE_MANAGER,
  ROLES.CASHIER,
  ROLES.ACCOUNTANT,
  ROLES.REFEREE,
  ROLES.CLUB_OWNER,
]);

export function listVenueStaff(venueId) {
  if (!venueId) {
    return [];
  }

  return loadStaffForVenue(venueId);
}

export function countVenueStaff(venueId, { includeInvited = true } = {}) {
  const staff = listVenueStaff(venueId);
  return staff.filter((member) => {
    if (member.status === USER_STATUS.SUSPENDED) {
      return false;
    }
    if (!includeInvited && member.status === USER_STATUS.INVITED) {
      return false;
    }
    return true;
  }).length;
}

export function inviteVenueStaff(venueId, { email, displayName, role, clubId = null }) {
  if (isRbacEnabled()) {
    const check = guardPermission(PERMISSIONS.USER_MANAGE, { venueId });
    if (!check.ok) {
      return check;
    }
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedRole = String(role || "").trim();

  if (!normalizedEmail) {
    return { ok: false, error: "Email không được để trống." };
  }

  if (!isValidRole(normalizedRole) || !INVITABLE_ROLES.includes(normalizedRole)) {
    return { ok: false, error: "Vai trò mời không hợp lệ." };
  }

  if (normalizedRole === ROLES.CLUB_OWNER && !clubId) {
    return { ok: false, error: "Chủ CLB cần gán clubId." };
  }

  const limitCheck = guardMaxUsers(venueId);
  if (!limitCheck.ok) {
    return limitCheck;
  }

  const staff = listVenueStaff(venueId);
  if (staff.some((member) => member.email === normalizedEmail)) {
    return { ok: false, error: "Email đã có trong danh sách nhân sự venue." };
  }

  const member = createUserRecord({
    id: `staff-${venueId}-${Date.now()}`,
    email: normalizedEmail,
    displayName: String(displayName || "").trim() || normalizedEmail.split("@")[0],
    role: normalizedRole,
    venueId,
    clubId: clubId || null,
    status: USER_STATUS.INVITED,
  });

  saveStaffForVenue(venueId, [...staff, member]);

  return { ok: true, member, staff: [...staff, member] };
}

export async function syncStaffInviteToSupabase(member) {
  if (!hasSupabaseConfig() || !member?.id) {
    return { ok: false, code: "NO_SUPABASE" };
  }

  return upsertProfileRow({
    id: member.id.startsWith("staff-") ? undefined : member.id,
    email: member.email,
    display_name: member.displayName,
    role: member.role,
    venue_id: member.venueId,
    club_id: member.clubId,
    status: member.status,
  });
}

export function activateVenueStaff(venueId, memberId) {
  if (isRbacEnabled()) {
    const check = guardPermission(PERMISSIONS.USER_MANAGE, { venueId });
    if (!check.ok) {
      return check;
    }
  }

  const staff = listVenueStaff(venueId);
  const index = staff.findIndex((member) => member.id === memberId);

  if (index < 0) {
    return { ok: false, error: "Không tìm thấy nhân sự." };
  }

  const next = staff.map((member, itemIndex) =>
    itemIndex === index
      ? {
          ...member,
          status: USER_STATUS.ACTIVE,
          updatedAt: new Date().toISOString(),
        }
      : member
  );

  saveStaffForVenue(venueId, next);
  return { ok: true, member: next[index] };
}

export function removeVenueStaff(venueId, memberId) {
  if (isRbacEnabled()) {
    const check = guardPermission(PERMISSIONS.USER_MANAGE, { venueId });
    if (!check.ok) {
      return check;
    }
  }

  const staff = listVenueStaff(venueId);
  const next = staff.filter((member) => member.id !== memberId);

  if (next.length === staff.length) {
    return { ok: false, error: "Không tìm thấy nhân sự." };
  }

  saveStaffForVenue(venueId, next);
  return { ok: true, staff: next };
}

export function getInvitableRoles() {
  return INVITABLE_ROLES;
}
