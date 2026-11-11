import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index(
  { eventId: 1, userId: 1 },
  { unique: true }
);

export default mongoose.model("Notification", notificationSchema);