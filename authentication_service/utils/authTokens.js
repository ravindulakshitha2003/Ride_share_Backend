import crypto from "crypto";
import jwt from "jsonwebtoken";

// Short-lived tokens that prove a code was checked.
// They use JWT_SECRET but carry a "purpose" so they can never be used
// as a login token (normal login tokens have no purpose field).

const SIGNUP_TOKEN_TTL = "30m";
const RESET_TOKEN_TTL = "15m";

// Given after /verify-signup-code. The register routes require it.
export function createSignupToken(email) {
  return jwt.sign({ purpose: "signup", email }, process.env.JWT_SECRET, {
    expiresIn: SIGNUP_TOKEN_TTL,
  });
}

// Returns true only if the token is valid, unexpired, and for this email.
export function checkSignupToken(token, email) {
  if (typeof token !== "string" || !token) return false;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.purpose === "signup" && payload.email === email;
  } catch {
    return false;
  }
}

// A fingerprint of the current password hash. Once the password changes,
// the fingerprint changes, so a reset token works only once.
function passwordFingerprint(passwordHash) {
  return crypto
    .createHash("sha256")
    .update(String(passwordHash))
    .digest("hex")
    .slice(0, 16);
}

// Given after /verify-reset-code. /reset-password requires it.
export function createResetToken(user) {
  return jwt.sign(
    { purpose: "reset", pf: passwordFingerprint(user.passwordHash) },
    process.env.JWT_SECRET,
    { subject: user._id.toString(), expiresIn: RESET_TOKEN_TTL }
  );
}

// Returns the user id from a reset token, or null if it is not valid.
export function readResetToken(token) {
  if (typeof token !== "string" || !token) return null;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.purpose !== "reset" || !payload.sub) return null;
    return { userId: payload.sub, fingerprint: payload.pf };
  } catch {
    return null;
  }
}

export function resetTokenMatches(fingerprint, passwordHash) {
  return fingerprint === passwordFingerprint(passwordHash);
}
