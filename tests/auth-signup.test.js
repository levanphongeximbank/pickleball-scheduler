import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { ROLES } from "../src/auth/roles.js";
import {
  isAuthSignupEnabled,
  getLoginRedirectUrl,
  getResetPasswordRedirectUrl,
  MIN_PASSWORD_LENGTH,
} from "../src/config/authConfig.js";
import {
  SIGNUP_INTENT,
  validateSignupForm,
  buildSignupUserMetadata,
} from "../src/features/identity/services/signupService.js";
import { listDevUsers, isDevAuthAllowed } from "../src/auth/authService.js";
import { hasSupabaseConfig } from "../src/auth/supabaseClient.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readSource(relativePath) {
  return readFileSync(join(__dirname, "..", relativePath), "utf8");
}

test("isAuthSignupEnabled — mặc định false khi env không set", () => {
  assert.equal(isAuthSignupEnabled(), false);
});

test("validateSignupForm — email, password, confirm khớp", () => {
  const invalid = validateSignupForm({
    email: "bad-email",
    password: "123",
    confirmPassword: "456",
    signupType: SIGNUP_INTENT.PLAYER,
  });
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.email, /định dạng/i);
  assert.match(invalid.errors.password, new RegExp(String(MIN_PASSWORD_LENGTH)));
  assert.match(invalid.errors.confirmPassword, /khớp/i);

  const valid = validateSignupForm({
    email: "player@example.com",
    password: "secret12",
    confirmPassword: "secret12",
    signupType: SIGNUP_INTENT.PLAYER,
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.normalizedEmail, "player@example.com");
});

test("validateSignupForm — chủ sân bắt buộc tên sân", () => {
  const missingVenue = validateSignupForm({
    email: "owner@example.com",
    password: "secret12",
    confirmPassword: "secret12",
    signupType: SIGNUP_INTENT.COURT_OWNER,
    venueName: "",
  });
  assert.equal(missingVenue.ok, false);
  assert.match(missingVenue.errors.venueName, /sân/i);
});

test("buildSignupUserMetadata — không gửi SUPER_ADMIN qua metadata", () => {
  const playerMeta = buildSignupUserMetadata({
    displayName: "Player A",
    signupIntent: SIGNUP_INTENT.PLAYER,
  });
  assert.equal(playerMeta.signup_intent, SIGNUP_INTENT.PLAYER);
  assert.equal("role" in playerMeta, false);
  assert.equal(playerMeta.display_name, "Player A");

  const ownerMeta = buildSignupUserMetadata({
    displayName: "Owner B",
    signupIntent: SIGNUP_INTENT.COURT_OWNER,
    venueName: "ABC Pickleball",
  });
  assert.equal(ownerMeta.signup_intent, SIGNUP_INTENT.COURT_OWNER);
  assert.equal(ownerMeta.venue_name, "ABC Pickleball");
  assert.equal("role" in ownerMeta, false);
});

test("auth redirect helpers — không hard-code localhost", () => {
  const loginPage = readSource("src/pages/LoginPage.jsx");
  const authService = readSource("src/auth/authService.js");
  const passwordService = readSource("src/features/identity/services/passwordService.js");

  assert.doesNotMatch(loginPage, /localhost:3000/);
  assert.doesNotMatch(authService, /localhost:3000/);
  assert.doesNotMatch(passwordService, /localhost:3000/);
  assert.doesNotMatch(authService, /qyewbxjsiiyufanzcjcq/);
});

test("getLoginRedirectUrl / getResetPasswordRedirectUrl — path đúng khi không có window", () => {
  assert.equal(getLoginRedirectUrl(), "/login");
  assert.equal(getResetPasswordRedirectUrl(), "/reset-password");
});

test("dev registry — không có admin@staging.local", () => {
  if (hasSupabaseConfig() || !isDevAuthAllowed()) {
    assert.equal(listDevUsers().some((user) => user.email === "admin@staging.local"), false);
    return;
  }

  const devUsers = listDevUsers();
  assert.ok(devUsers.length > 0);
  assert.equal(
    devUsers.some((user) => user.email === "admin@staging.local"),
    false
  );
  assert.ok(
    devUsers.some(
      (user) =>
        user.role === ROLES.PLATFORM_ADMIN || user.role === ROLES.SUPER_ADMIN
    ),
    true
  );
});

test("LoginPage source — signup gated by isAuthSignupEnabled", () => {
  const loginPage = readSource("src/pages/LoginPage.jsx");
  assert.match(loginPage, /isAuthSignupEnabled/);
  assert.match(loginPage, /validateSignupForm/);
  assert.match(loginPage, /Xác nhận mật khẩu/);
  assert.match(loginPage, /Đăng ký tài khoản/);
  assert.match(loginPage, /Quay lại đăng nhập/);
});

test("signUpWithPassword source — dùng emailRedirectTo và không gửi role metadata", () => {
  const authService = readSource("src/auth/authService.js");
  assert.match(authService, /getLoginRedirectUrl/);
  assert.match(authService, /buildSignupUserMetadata/);
  assert.doesNotMatch(authService, /role:\s*["']SUPER_ADMIN["']/);
});
