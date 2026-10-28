
import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    nicNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    drivingLicenceNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    licenceClass: {
      type: [String],
      required: true,
      validate: {
        validator: (classes) =>
          Array.isArray(classes) &&
          classes.length > 0 &&
          classes.every((item) => typeof item === "string" && item.trim()),
        message: "At least one valid licence class is required",
      },
    },

    licenceExpiryDate: {
      type: Date,
      required: true,
      validate: {
        validator: (date) =>
          date instanceof Date &&
          !Number.isNaN(date.getTime()),
        message: "A valid licence expiry date is required",
      },
    },

    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    emergencyContactName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    emergencyContactPhone: {
      type: String,
      required: true,
      trim: true,
    },

    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Driver", driverSchema);
