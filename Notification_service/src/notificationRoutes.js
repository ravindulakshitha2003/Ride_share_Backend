
import express from "express";
import { requireAuth } from "./middleware/authMiddleware.js";

import {
  getNotifications,
  getUnread,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from "./controllers/notificationController.js";

const router = express.Router();

// Get all notifications
router.get("/", requireAuth, getNotifications);

// Get unread notifications
router.get("/unread", requireAuth, getUnread);

// Mark all notifications as read
router.patch("/read-all", requireAuth, markAllAsRead);

// Mark one notification as read
router.patch("/:id/read", requireAuth, markAsRead);

router.get("/unread-count", requireAuth, getUnreadCount);

export default router;
