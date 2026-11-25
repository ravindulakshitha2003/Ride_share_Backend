import mongoose from "mongoose";

// A sign-up code sent to an email BEFORE the account exists.
// One record per email; MongoDB deletes it automatically after it expires.
const emailVerificationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// TTL index: the document is removed once expiresAt has passed.
emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("EmailVerification", emailVerificationSchema);
