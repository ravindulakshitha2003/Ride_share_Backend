
import express from "express";

import {
  register,
  login,
  getMe,
  deleteMyAccount,
  updateMyAccount,
} from "../controllers/authController.js";

import {
  registerDriverWithVehicle,
} from "../controllers/combinedRegistrationController.js";

import upload from "../middleware/uploadMiddleware.js";
import registrationUpload from "../middleware/registrationUpload.js";

import {
  verifyToken,
  allowRoles,
} from "../middleware/authMiddleware.js";

import {
  verifyEmail,
  resendVerification,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  sendSignupCode,
  verifySignupCode,
} from "../controllers/authController.js";
import {
  signupCodeLimiter,
  verifySignupLimiter,
  verifyEmailLimiter,
  resendLimiter,
  forgotLimiter,
  verifyResetLimiter,
  resetPasswordLimiter,
  googleLimiter,
} from '../middleware/rateLimiters.js';
import {
  googleLogin,
  googleCompleteSignup,
} from "../controllers/googleAuthController.js";

const router = express.Router();

// Passenger registration
router.post(
  "/register",
  upload.single("profilePhoto"),
  register
);

// Login for passengers and drivers
router.post("/login", login);

// Google sign-in
//   1. { idToken }  -> logs in, or { needsProfile, googleSignupToken }
//   2. { googleSignupToken, mobile, ... } -> creates the account, logs in
router.post("/google", googleLimiter, googleLogin);
router.post("/google/complete", googleLimiter, googleCompleteSignup);

// Driver registration: account + driver details + vehicle details
router.post(
  "/register-driver",
  registrationUpload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "vehiclePhoto", maxCount: 1 },
  ]),
  registerDriverWithVehicle
);

// Sign up: confirm the email BEFORE the register form
//   1. { email }        -> emails a 6-digit code
//   2. { email, code }  -> { signupToken }, sent with /register or /register-driver
router.post('/send-signup-code', signupCodeLimiter, sendSignupCode);
router.post('/verify-signup-code', verifySignupLimiter, verifySignupCode);

// Older flow: verify an existing, unverified account (e.g. after an email change)
router.post('/verify-email', verifyEmailLimiter, verifyEmail);
router.post('/resend-verification', resendLimiter, resendVerification);

// Forgot password
//   1. { email }                    -> emails a 6-digit code
//   2. { email, code }              -> { resetToken }
//   3. { resetToken, newPassword }  -> password changed
router.post('/forgot-password', forgotLimiter, forgotPassword);
router.post('/verify-reset-code', verifyResetLimiter, verifyResetCode);
router.post('/reset-password', resetPasswordLimiter, resetPassword);

// View own profile (passengers)
router.get(
  "/me",
  verifyToken,
  getMe
);

// Update logged-in user's profile
router.put(
  "/me",
  verifyToken,
  upload.single("profilePhoto"),
  updateMyAccount
);

//delete user
router.delete(
  "/me",
  verifyToken,
  allowRoles("passenger"),
  deleteMyAccount
);

export default router;
