import mongoose from "mongoose";

const pushTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    expoPushToken: {
      type: String,
      required: true,
      unique: true,
    },
    platform: {
      type: String,
      enum: ["android", "ios"],
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("PushToken", pushTokenSchema);