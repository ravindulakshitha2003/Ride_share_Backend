
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


// Convert Booking Service events into notifications.
export async function createBookingNotification(event) {
  const { eventId, eventType, data } = event;

  if (!eventId || !eventType || !data?.bookingId) {
    throw new Error("Invalid booking event");
  }

  let userId;
  let title;
  let body;

  switch (eventType) {
    case "booking.requested":
      userId = data.driverId;
      title = "New Booking Request";
      body =
        `A passenger requested ${data.requestedSeats} seat(s) ` +
        `from ${data.passengerOrigin} to ${data.passengerDestination}.`;
      break;

    case "booking.confirmed":
      userId = data.passengerId;
      title = "Booking Confirmed";
      body = "Your booking has been confirmed by the driver.";
      break;

    case "booking.rejected":
      userId = data.passengerId;
      title = "Booking Rejected";
      body = data.reason
        ? `Your booking was rejected. Reason: ${data.reason}`
        : "Your booking was rejected by the driver.";
      break;

    case "booking.cancelled":
      if (data.cancelledBy === "PASSENGER") {
        userId = data.driverId;
      } else if (data.cancelledBy === "DRIVER") {
        userId = data.passengerId;
      } else {
        throw new Error("Invalid cancelledBy value");
      }

      title = "Booking Cancelled";
      body = data.reason
        ? `The booking was cancelled. Reason: ${data.reason}`
        : "The booking was cancelled.";
      break;

    default:
      throw new Error(`Unsupported event type: ${eventType}`);
  }

  if (!userId) {
    throw new Error(`Recipient missing for ${eventType}`);
  }

  return createNotification({
    eventId,
    userId: String(userId),
    type: eventType,
    title,
    body,
    data: {
      ...data,
      bookingId: String(data.bookingId)
    }
  });
}
