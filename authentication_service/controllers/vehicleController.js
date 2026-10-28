
import Vehicle from "../models/Vehicle.js";
import User from "../models/User.js";
import cloudinary from "../cloudinary.js";

const allowedTypes = [
  "car",
  "van",
  "motorcycle",
  "three_wheeler",
];

// Upload vehicle photo to a separate Cloudinary folder
function uploadVehiclePhoto(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "share-ride/vehicle-photos",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        if (!result) {
          return reject(new Error("Cloudinary upload failed"));
        }

        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

export async function registerVehicle(req, res, next) {
  let uploadedPhoto;

  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({
        message: "Only drivers can register vehicles",
      });
    }

    const {
      registrationNumber,
      make,
      model,
      year,
      color,
      vehicleType,
      seats,
    } = req.body ?? {};

    // Validate vehicle fields.
    // Multipart form-data sends numbers as strings.
    const vehicleYear = Number(year);
    const vehicleSeats = Number(seats);

  

    if (
      typeof registrationNumber !== "string" ||
      !registrationNumber.trim() ||
      typeof make !== "string" ||
      !make.trim() ||
      typeof model !== "string" ||
      !model.trim() ||
      typeof color !== "string" ||
      !color.trim() ||
      year === undefined ||
      year === "" ||
      !Number.isInteger(vehicleYear) ||
      seats === undefined ||
      seats === "" ||
      !Number.isInteger(vehicleSeats) ||
      !allowedTypes.includes(vehicleType)
    ) {
      return res.status(400).json({
        message: "Please provide valid vehicle details",
      });
    }

    if (
      vehicleYear < 1900 ||
      vehicleYear > new Date().getFullYear() + 1 ||
      vehicleSeats < 1 ||
      vehicleSeats > 100
    ) {
      return res.status(400).json({
        message: "Invalid vehicle year or seat count",
      });
    }

    // Require a vehicle photo.
    if (!req.file) {
      return res.status(400).json({
        message: "Vehicle photo is required",
      });
    }

    // Ensure the driver account exists.
    const driver = await User.findOne({
      _id: req.user.id,
      role: "driver",
    });

    if (!driver) {
      return res.status(403).json({
        message: "Driver account not found",
      });
    }

    // Upload the photo to Cloudinary.
    uploadedPhoto = await uploadVehiclePhoto(req.file.buffer);

    // Save the vehicle and photo details in MongoDB.
    const vehicle = await Vehicle.create({
      driver: driver._id,
      registrationNumber: registrationNumber.trim().toUpperCase(),
      make: make.trim(),
      model: model.trim(),
      year: vehicleYear,
      color: color.trim(),
      vehicleType,
      seats: vehicleSeats,
      vehiclePhotoUrl: uploadedPhoto.secure_url,
      vehiclePhotoPublicId: uploadedPhoto.public_id,
    });

    return res.status(201).json({
      message: "Vehicle registered successfully",
      vehicle,
    });
  } catch (error) {
    // Remove uploaded photo if database creation fails.
    if (uploadedPhoto?.public_id) {
      try {
        await cloudinary.uploader.destroy(uploadedPhoto.public_id);
      } catch (cleanupError) {
        console.error("Vehicle photo cleanup failed:", cleanupError.message);
      }
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Vehicle registration number already exists",
      });
    }

    next(error);
  }
}

export async function getMyVehicles(req, res, next) {
  try {
    const vehicles = await Vehicle.find({
      driver: req.user.id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      count: vehicles.length,
      vehicles,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteMyVehicle(req, res, next) {
  try {
    const vehicle = await Vehicle.findOne({
      _id: req.params.id,
      driver: req.user.id,
    }).select("+vehiclePhotoPublicId");

    if (!vehicle) {
      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    // Delete the database record.
    await vehicle.deleteOne();

    // Delete its Cloudinary photo, if present.
    if (vehicle.vehiclePhotoPublicId) {
      try {
        await cloudinary.uploader.destroy(
          vehicle.vehiclePhotoPublicId
        );
      } catch (cleanupError) {
        console.error("Vehicle photo deletion failed:", cleanupError.message);
      }
    }

    return res.status(200).json({
      message: "Vehicle deleted successfully",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid vehicle ID",
      });
    }

    next(error);
  }
}
