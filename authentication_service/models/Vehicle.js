import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    // Link the vehicle to the registered driver/user
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Vehicle information
    vehicleType: {
      type: String,
      enum: ["car", "van", "suv", "other"],
      required: true,
      lowercase: true,
      trim: true,
    },

    brand: {
      type: String,
      required: true,
      trim: true,
    },

    model: {
      type: String,
      required: true,
      trim: true,
    },

    year: {
      type: Number,
      required: true,
      min: 1900,
      max: new Date().getFullYear() + 1,
    },

    color: {
      type: String,
      required: true,
      trim: true,
    },



    passengerSeats: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },

    airConditioning: {
      type: Boolean,
      default: false,
    },

    luggageSpace: {
      type: String,
      enum: ["available", "limited", "unavailable"],
      required: true,
      lowercase: true,
    },

    vehicleDescription: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    crNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    revenueLicenceExpiry: {
      type: Date,
      required: true,
    },

    insuranceExpiry: {
      type: Date,
      required: true,
    },

    // Uploaded vehicle photo
    vehiclePhotoUrl: {
      type: String,
      required: true,
      trim: true,
    },

    vehiclePhotoPublicId: {
      type: String,
      required: true,
      select: false,
    },
  },
  { timestamps: true }
);

vehicleSchema.index({ driver: 1, createdAt: -1 });

export default mongoose.model("Vehicle", vehicleSchema);