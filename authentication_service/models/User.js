import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    // Google-only accounts have no password, so it is required only
    // when the account is not linked to Google.
    passwordHash: {
      type: String,
      required() {
        return !this.googleId;
      },
      select: false,
    },

    // Google account id (the "sub" claim of the Google ID token).
    // sparse: lets many email/password users have no googleId.
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    // How the account was first created.
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    role: {
      type: String,
      enum: ["driver", "passenger"],
      default: "passenger",
      required: true,
    },

    gender: {
      type: String,
      enum: ["male", "female", "prefer_not_to_say"],
    },

    dateOfBirth: {
      type: Date,
      validate: {
        validator(value) {
          return !value || value <= new Date();
        },
        message: "Date of birth cannot be in the future",
      },
    },

    profilePhotoUrl: {
      type: String,
      required: true,
      trim: true,
    },

    // Not set when the photo is the Google profile picture
    // (it is not stored in Cloudinary).
    profilePhotoPublicId: {
      type: String,
      required() {
        return !this.googleId;
      },
      select: false,
    },

    // True once the email has been confirmed with a code.
    emailVerified: {
      type: Boolean,
      default: false,
    },

    // Email verification code (existing, unverified accounts)
    emailOtpHash: { type: String, select: false },
    emailOtpExpires: { type: Date, select: false },
    emailOtpAttempts: { type: Number, default: 0, select: false },

    // Forgot-password code
    resetOtpHash: { type: String, select: false },
    resetOtpExpires: { type: Date, select: false },
    resetOtpAttempts: { type: Number, default: 0, select: false },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);