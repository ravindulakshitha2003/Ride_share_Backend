import { OAuth2Client } from "google-auth-library";

// Checks a Google ID token sent by the mobile app.
//
// The app signs in with the WEB client id as "webClientId", so the token's
// audience ("aud") is the web client id. GOOGLE_CLIENT_IDS may hold several
// ids separated by commas (web, android, ios) - any of them is accepted.

const client = new OAuth2Client();

function allowedAudiences() {
  return (process.env.GOOGLE_CLIENT_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

// Returns { googleId, email, emailVerified, name, picture } or throws.
export async function verifyGoogleIdToken(idToken) {
  const audience = allowedAudiences();

  if (!audience.length) {
    throw new Error("GOOGLE_CLIENT_IDS is not configured");
  }

  // Checks the signature, expiry, issuer and audience.
  const ticket = await client.verifyIdToken({ idToken, audience });
  const payload = ticket.getPayload();

  return {
    googleId: payload.sub,
    email: payload.email?.toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: payload.name || payload.given_name || "",
    picture: payload.picture || "",
  };
}
