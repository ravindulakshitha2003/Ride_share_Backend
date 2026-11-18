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

    passwordHash: {
      type: String,
      required: true,
      select: false,
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

    profilePhotoPublicId: {
      type: String,
      required: true,
      select: false,
    },
    emailVerified: { type: Boolean, default: false },
    emailOtpHash: { type: String, select: false },
    emailOtpExpires: { type: Date, select: false },
    emailOtpAttempts: { type: Number, default: 0, select: false },

    resetOtpHash: { type: String, select: false },
    resetOtpExpires: { type: Date, select: false },
    resetOtpAttempts: { type: Number, default: 0, select: false },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);