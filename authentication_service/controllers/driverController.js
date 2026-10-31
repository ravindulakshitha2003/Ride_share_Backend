
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import Driver from "../models/Driver.js";
import Vehicle from "../models/Vehicle.js";
import cloudinary from "../cloudinary.js";

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

//to delete driver details
export async function convertDriverToPassenger(req, res, next) {
  const session = await mongoose.startSession();

  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        message: "Password is required to convert your account",
      });
    }

    // Find the logged-in user
    const user = await User.findById(req.user.id).select("+passwordHash");

    if (!user) {
      return res.status(404).json({
        message: "User account not found",
      });
    }

    if (user.role !== "driver") {
      return res.status(403).json({
        message: "Only drivers can convert their accounts",
      });
    }

    // Verify the user's password
    const passwordMatch = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Incorrect password",
      });
    }

    let vehiclePhotoPublicIds = [];

    await session.withTransaction(async () => {
      const driver = await Driver.findOne({
        driverId: user._id,
      }).session(session);

      if (!driver) {
        throw new Error("Driver profile not found");
      }

      // Find vehicles belonging to this driver
      const vehicles = await Vehicle.find({
        driver: driver._id,
      })
        .select("+vehiclePhotoPublicId")
        .session(session);

      vehiclePhotoPublicIds = vehicles
        .map((vehicle) => vehicle.vehiclePhotoPublicId)
        .filter(Boolean);

      // Delete associated vehicles
      await Vehicle.deleteMany({
        driver: driver._id,
      }).session(session);

      // Delete driver profile
      await Driver.deleteOne({
        _id: driver._id,
      }).session(session);

      // Keep the User account but change its role
      user.role = "passenger";
      await user.save({ session });
    });

    // Delete vehicle photos from Cloudinary after the DB transaction succeeds
    for (const publicId of vehiclePhotoPublicIds) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (cloudinaryError) {
        console.error(
          "Failed to delete vehicle photo from Cloudinary:",
          cloudinaryError.message
        );
      }
    }

    return res.status(200).json({
      message: "Driver profile removed and account converted to passenger successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
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
