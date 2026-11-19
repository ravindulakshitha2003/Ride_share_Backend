import express from "express";
import PushToken from "./models/PushToken.js";
import { requireAuth } from "./authMiddleware.js";

const router = express.Router();

router.post("/devices", requireAuth, async (req, res, next) => {
  try {
    const { expoPushToken, platform } = req.body;

    if (
      typeof expoPushToken !== "string" ||
      !/^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(expoPushToken)
    ) {
      return res.status(400).json({
        message: "A valid Expo push token is required",
      });
    }

    if (!["android", "ios"].includes(platform)) {
      return res.status(400).json({
        message: "Platform must be android or ios",
      });
    }

    const token = await PushToken.findOneAndUpdate(
      { expoPushToken },
      {
        userId: req.user.id,
        expoPushToken,
        platform,
        active: true,
        lastSeenAt: new Date(),
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      message: "Device registered for notifications",
      deviceId: token.id,
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/devices", requireAuth, async (req, res, next) => {
  try {
    const { expoPushToken } = req.body;

    await PushToken.updateOne(
      {
        expoPushToken,
        userId: req.user.id,
      },
      { active: false }
    );

    return res.status(200).json({
      message: "Device notification token deactivated",
    });
  } catch (error) {
    next(error);
  }
});

export default router;