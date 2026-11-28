import User from "../models/User.js";
import { verifyGoogleIdToken } from "../utils/google.js";
import {
  createGoogleSignupToken,
  readGoogleSignupToken,
} from "../utils/authTokens.js";
import {
  createToken,
  publicUser,
  normalizeMobile,
} from "./authController.js";

const MOBILE_REGEX = /^(?:0\d{9}|\+94\d{9})$/;

// POST /api/auth/google   { idToken }
//
// 1. Google account already linked       -> log in
// 2. Email already registered (password) -> link Google to it, log in
// 3. New person                          -> { needsProfile: true, googleSignupToken }
//    The app then asks for a mobile number and calls /google/complete.
export async function googleLogin(req, res, next) {
  try {
    const { idToken } = req.body ?? {};

    if (typeof idToken !== "string" || !idToken) {
      return res.status(400).json({ message: "Google ID token is required" });
    }

    let google;
    try {
      google = await verifyGoogleIdToken(idToken);
    } catch (error) {
      console.error("Google token check failed:", error.message);
      return res.status(401).json({ message: "Google sign-in failed. Please try again." });
    }

    // Never trust an unverified Google email for linking or sign-up.
    if (!google.email || !google.emailVerified) {
      return res.status(401).json({
        message: "Your Google email is not verified.",
      });
    }

    // 1. Already linked
    let user = await User.findOne({ googleId: google.googleId });

    // 2. Same email, made with a password -> link it.
    // Safe because Google has confirmed the person owns this email.
    if (!user) {
      user = await User.findOne({ email: google.email });

      if (user) {
        user.googleId = google.googleId;
        user.emailVerified = true;
        await user.save();
      }
    }

    if (user) {
      return res.status(200).json({
        message: "Login successful",
        user: publicUser(user),
        token: createToken(user),
      });
    }

    // 3. New person: we still need a mobile number (required in User).
    return res.status(200).json({
      message: "Complete your profile to finish signing up",
      needsProfile: true,
      googleSignupToken: createGoogleSignupToken(google),
      profile: {
        name: google.name,
        email: google.email,
        picture: google.picture,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This Google account is already linked to another user.",
      });
    }
    next(error);
  }
}

// POST /api/auth/google/complete
//   { googleSignupToken, mobile, name?, gender?, dateOfBirth? }
// Creates a passenger account. Drivers add their details later
// from the driver screens (POST /api/drivers).
export async function googleCompleteSignup(req, res, next) {
  try {
    const { googleSignupToken, mobile, name, gender, dateOfBirth } = req.body ?? {};

    const google = readGoogleSignupToken(googleSignupToken);

    if (!google) {
      return res.status(400).json({
        message: "Your Google sign-in has expired. Please try again.",
        code: "GOOGLE_SIGNUP_EXPIRED",
      });
    }

    if (typeof mobile !== "string" || !MOBILE_REGEX.test(mobile.trim())) {
      return res.status(400).json({
        message: "Enter a valid Sri Lankan mobile number",
      });
    }

    const finalName =
      typeof name === "string" && name.trim() ? name.trim() : google.name;

    if (!finalName || finalName.length > 100) {
      return res.status(400).json({
        message: "Name must contain 1-100 characters",
      });
    }

    if (
      gender !== undefined &&
      gender !== "" &&
      !["male", "female", "prefer_not_to_say"].includes(gender)
    ) {
      return res.status(400).json({ message: "Invalid gender value" });
    }

    let parsedDateOfBirth;
    if (dateOfBirth) {
      parsedDateOfBirth = new Date(`${dateOfBirth}T00:00:00.000Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
        Number.isNaN(parsedDateOfBirth.getTime()) ||
        parsedDateOfBirth > new Date()
      ) {
        return res.status(400).json({ message: "Enter a valid date of birth" });
      }
    }

    const normalizedMobile = normalizeMobile(mobile.trim());

    const existing = await User.findOne({
      $or: [
        { email: google.email },
        { mobile: normalizedMobile },
        { googleId: google.googleId },
      ],
    });

    if (existing) {
      return res.status(409).json({
        message: "Email or mobile number already registered",
      });
    }

    const user = await User.create({
      name: finalName,
      mobile: normalizedMobile,
      email: google.email,
      googleId: google.googleId,
      authProvider: "google",
      role: "passenger",
      ...(gender ? { gender } : {}),
      ...(parsedDateOfBirth ? { dateOfBirth: parsedDateOfBirth } : {}),
      // Google picture until the user uploads their own photo.
      profilePhotoUrl: google.picture || "https://www.gravatar.com/avatar/?d=mp&s=200",
      emailVerified: true,
    });

    return res.status(201).json({
      message: "Account created",
      user: publicUser(user),
      token: createToken(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email or mobile number already registered",
      });
    }
    next(error);
  }
}
