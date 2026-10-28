
import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    make: {
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

    vehicleType: {
      type: String,
      enum: ["car", "van", "motorcycle", "three_wheeler"],
      required: true,
    },

    seats: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },

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
  {
    timestamps: true,
  }
);

vehicleSchema.index({ driver: 1, createdAt: -1 });

export default mongoose.model("Vehicle", vehicleSchema);
