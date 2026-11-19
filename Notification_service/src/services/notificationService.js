
import Notification from "../models/Notification.js";

// 1. Create and save a notification
export async function createNotification(notificationData) {
  const {
    eventId,
    userId,
    type,
    title,
    body,
    data = {},
  } = notificationData;

  if (!eventId || !userId || !type || !title || !body) {
    throw new Error("Required notification fields are missing");
  }

  const notification = await Notification.findOneAndUpdate(
    { eventId, userId },
    {
      $setOnInsert: {
        eventId,
        userId,
        type,
        title,
        body,
        data,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  return notification;
}

// 2. Get all notifications for a user
export async function getUserNotifications(
  userId,
  page = 1,
  limit = 20
) {
  page = Math.max(1, Number(page) || 1);
  limit = Math.min(100, Math.max(1, Number(limit) || 20));

  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),

    Notification.countDocuments({ userId }),
  ]);

  return {
    notifications,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// 3. Get unread notifications
export async function getUnreadNotifications(userId) {
  return Notification.find({
    userId,
    readAt: null,
  }).sort({ createdAt: -1 });
}

// 4. Mark one notification as read
export async function markNotificationAsRead(
  notificationId,
  userId
) {
  return Notification.findOneAndUpdate(
    {
      _id: notificationId,
      userId,
    },
    {
      $set: { readAt: new Date() },
    },
    {
      new: true,
      runValidators: true,
    }
  );
}

// 5. Mark all notifications as read
export async function markAllNotificationsAsRead(userId) {
  const result = await Notification.updateMany(
    {
      userId,
      readAt: null,
    },
    {
      $set: { readAt: new Date() },
    }
  );

  return {
    modifiedCount: result.modifiedCount,
  };
}
export async function getUnreadNotificationCount(userId) {
  return Notification.countDocuments({
    userId,
    readAt: null,
  });
}

