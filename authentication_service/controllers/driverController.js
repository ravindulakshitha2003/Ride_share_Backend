
import Driver from "../models/Driver.js";

const driverFields = [
 
  "nicNumber",
  "drivingLicenceNumber",
  "licenceClass",
  "licenceExpiryDate",
  "address",
  "emergencyContactName",
  "emergencyContactPhone",
];

export async function createDriverProfile(req, res, next) {
  try {
    const {
      nicNumber,
      drivingLicenceNumber,
      licenceClass,
      licenceExpiryDate,
      address,
      emergencyContactName,
      emergencyContactPhone,
    } = req.body;

    if (
      !nicNumber ||
      !drivingLicenceNumber ||
      !licenceClass ||
      !licenceExpiryDate ||
      !address ||
      !emergencyContactName ||
      !emergencyContactPhone
    ) {
      return res.status(400).json({
        message: "All driver profile fields are required",
      });
    }

    const classes = Array.isArray(licenceClass)
      ? licenceClass
      : [licenceClass];

    const expiry = new Date(licenceExpiryDate);

    if (Number.isNaN(expiry.getTime())) {
      return res.status(400).json({
        message: "Enter a valid licence expiry date",
      });
    }

    const existingDriver = await Driver.findOne({
      driverId: req.user.id,
    });

    if (existingDriver) {
      return res.status(409).json({
        message: "Driver profile already exists",
      });
    }

    const driver = await Driver.create({
      driverId: req.user.id,
      nicNumber,
      drivingLicenceNumber,
      licenceClass: classes,
      licenceExpiryDate: expiry,
      address,
      emergencyContactName,
      emergencyContactPhone,
      verificationStatus: "pending",
    });

    return res.status(201).json({
      message: "Driver profile created successfully",
      driver,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "NIC, licence number, or driver profile is already registered",
      });
    }

    next(error);
  }
}

export async function getMyDriverProfile(req, res, next) {
  try {
    const driver = await Driver.findOne({
      driverId: req.user.id,
    });

    if (!driver) {
      return res.status(404).json({
        message: "Driver profile not found. Register your driver details first.",
      });
    }

    return res.status(200).json({ driver });
  } catch (error) {
    next(error);
  }
}

export async function updateMyDriverProfile(req, res, next) {
  try {
    const updates = {};

    for (const field of driverFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.licenceClass !== undefined) {
      updates.licenceClass = Array.isArray(updates.licenceClass)
        ? updates.licenceClass
        : [updates.licenceClass];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No valid driver details provided",
      });
    }

    const driver = await Driver.findOneAndUpdate(
      { driverId: req.user.id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!driver) {
      return res.status(404).json({
        message: "Driver profile not found. Register your driver details first.",
      });
    }

    return res.status(200).json({
      message: "Driver profile updated successfully",
      driver,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "NIC or driving licence number is already registered",
      });
    }

    next(error);
  }
}
