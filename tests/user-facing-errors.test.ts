import test from "node:test";
import assert from "node:assert/strict";
import { authErrorMessage, isMissingDatabaseColumn, profileErrorMessage } from "../lib/user-facing-errors.ts";

test("auth errors are translated into useful product copy", () => {
  assert.equal(authErrorMessage({ message: "Invalid login credentials" }), "The email or password is incorrect.");
  assert.equal(authErrorMessage({ message: "Email not confirmed" }), "Confirm your email before signing in.");
  assert.equal(authErrorMessage({ message: "User already registered" }), "An account with this email already exists. Try signing in instead.");
});

test("confirmation-email errors explain delivery failures without exposing provider details", () => {
  assert.equal(authErrorMessage({ code: "email_not_confirmed" }), "Confirm your email before signing in.");
  assert.match(authErrorMessage({ code: "email_address_not_authorized" }), /email service needs to be configured/);
  assert.match(authErrorMessage({ code: "over_email_send_rate_limit" }), /sending limit/);
  assert.match(authErrorMessage({ message: "Error sending confirmation email" }), /could not send your link/);
});

test("unknown provider details are not exposed", () => {
  const raw = "column profiles.onboarding_completed does not exist";
  assert.equal(authErrorMessage({ message: raw }), "We could not complete that request. Please try again.");
  assert.equal(profileErrorMessage("load").includes("onboarding_completed"), false);
});

test("missing database columns are recognized by code or message", () => {
  assert.equal(isMissingDatabaseColumn({ code: "42703", message: "column profiles.onboarding_completed does not exist" }, "onboarding_completed"), true);
  assert.equal(isMissingDatabaseColumn({ code: "PGRST204", message: "Could not find onboarding_completed" }, "onboarding_completed"), true);
  assert.equal(isMissingDatabaseColumn({ code: "42501", message: "permission denied" }, "onboarding_completed"), false);
});
