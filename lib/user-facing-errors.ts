type ErrorLike = {
  code?: string;
  message?: string;
};

function errorDetails(error: unknown) {
  if (!error || typeof error !== "object") return { code: "", message: "" };
  const candidate = error as ErrorLike;
  return {
    code: candidate.code ?? "",
    message: candidate.message?.toLowerCase() ?? "",
  };
}

export function isMissingDatabaseColumn(error: unknown, column?: string) {
  const { code, message } = errorDetails(error);
  const missingColumn = code === "42703" || code === "PGRST204" || message.includes("does not exist");
  return missingColumn && (!column || message.includes(column.toLowerCase()));
}

export function authErrorMessage(error: unknown, fallback = "We could not complete that request. Please try again.") {
  const { code, message } = errorDetails(error);

  if (code === "email_address_not_authorized") return "Confirmation emails cannot be sent to this address right now. The app's email service needs to be configured.";
  if (code === "over_email_send_rate_limit") return "The email service has reached its sending limit. Wait and try again later.";
  if (code === "email_not_confirmed") return "Confirm your email before signing in.";
  if (message.includes("error sending confirmation email") || message.includes("error sending recovery email")) return "The email service could not send your link. Try again later.";
  if (message.includes("invalid login credentials")) return "The email or password is incorrect.";
  if (message.includes("email not confirmed")) return "Confirm your email before signing in.";
  if (message.includes("user already registered") || message.includes("already been registered")) return "An account with this email already exists. Try signing in instead.";
  if (message.includes("password") && (message.includes("weak") || message.includes("characters"))) return "Use a stronger password with at least 8 characters, including a letter and a number.";
  if (message.includes("rate limit") || message.includes("too many requests")) return "Too many attempts were made. Wait a few minutes and try again.";
  if (message.includes("expired") || message.includes("otp")) return "This link has expired or was already used. Request a new one.";
  if (message.includes("same password")) return "Choose a password you have not used for this account.";
  if (message.includes("network") || message.includes("fetch")) return "We could not reach the sign-in service. Check your connection and try again.";
  return fallback;
}

export function profileErrorMessage(action: "load" | "save") {
  return action === "load"
    ? "We could not load your profile right now. Your account is still secure; try refreshing the page."
    : "We could not save your profile right now. Please try again.";
}
