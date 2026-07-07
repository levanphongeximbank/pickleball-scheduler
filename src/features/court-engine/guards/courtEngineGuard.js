import { PERMISSIONS } from "../../identity/constants/permissions.js";

export const COURT_ENGINE_PERMISSIONS = Object.freeze({
  USE: "court_engine.use",
  MANAGE: "court_engine.manage",
  CHECK_IN: "court_engine.check_in",
  TRANSFER: "court_engine.transfer",
});

export function canUseCourtEngine(canFn, context = {}) {
  if (typeof canFn !== "function") {
    return true;
  }
  return (
    canFn(PERMISSIONS.DIRECTOR_USE, context) ||
    canFn(PERMISSIONS.SCHEDULING_RUN, context) ||
    canFn(COURT_ENGINE_PERMISSIONS.USE, context)
  );
}

export function canRunScheduling(canFn, context = {}) {
  if (typeof canFn !== "function") {
    return true;
  }
  return (
    canFn(PERMISSIONS.SCHEDULING_RUN, context) ||
    canFn(PERMISSIONS.DIRECTOR_USE, context) ||
    canFn(COURT_ENGINE_PERMISSIONS.USE, context) ||
    canFn(COURT_ENGINE_PERMISSIONS.MANAGE, context)
  );
}

export function canViewCourts(canFn, context = {}) {
  if (typeof canFn !== "function") {
    return true;
  }
  return canFn(PERMISSIONS.COURT_VIEW, context);
}

export function canCreateCourt(canFn, context = {}) {
  if (typeof canFn !== "function") {
    return true;
  }
  return canFn(PERMISSIONS.COURT_CREATE, context);
}

export function canUpdateCourt(canFn, context = {}) {
  if (typeof canFn !== "function") {
    return true;
  }
  return (
    canFn(PERMISSIONS.COURT_UPDATE, context) ||
    canFn(COURT_ENGINE_PERMISSIONS.MANAGE, context)
  );
}

export function canManageCourtEngine(canFn, context = {}) {
  if (typeof canFn !== "function") {
    return true;
  }
  return (
    canFn(PERMISSIONS.TOURNAMENT_UPDATE, context) ||
    canFn(COURT_ENGINE_PERMISSIONS.MANAGE, context) ||
    canUseCourtEngine(canFn, context)
  );
}

export function canTransferCourt(canFn, context = {}) {
  if (typeof canFn !== "function") {
    return true;
  }
  return (
    canFn(COURT_ENGINE_PERMISSIONS.TRANSFER, context) ||
    canFn(PERMISSIONS.COURT_UPDATE, context) ||
    canManageCourtEngine(canFn, context)
  );
}
