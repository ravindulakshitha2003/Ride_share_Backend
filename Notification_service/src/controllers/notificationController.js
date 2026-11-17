
import {
  getUserNotifications,
  getUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../services/notificationService.js";

// 1. Get all notifications
export async function getNotifications(req, res, next) {
  try {
    const userId = req.user.id;

    const { page = 1, limit = 20 } = req.query;

    const result = await getUserNotifications(
      userId,
      page,
      limit
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

// 2. Get unread notifications
export async function getUnread(req, res, next) {
  try {
    const userId = req.user.id;

    const notifications = await getUnreadNotifications(userId);

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    next(error);
  }
}

// 3. Mark one notification as read
export async function markAsRead(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const notification = await markNotificationAsRead(
      id,
      userId
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    next(error);
  }
}

// 4. Mark all notifications as read
export async function markAllAsRead(req, res, next) {
  try {
    const userId = req.user.id;

    const result = await markAllNotificationsAsRead(userId);

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
}
