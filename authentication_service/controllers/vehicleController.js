
import mongoose from "mongoose";

import Vehicle from "../models/Vehicle.js";
import Driver from "../models/Driver.js";
import cloudinary from "../cloudinary.js";

const allowedTypes = ["car", "van", "suv", "other"];

// Upload a vehicle photo to Cloudinary.
function uploadVehiclePhoto(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "share-ride/vehicle-photos",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
      },
      (error, result) => {
        if (error) return reject(error);

        if (!result) {
          return reject(new Error("Cloudinary upload failed"));
        }

        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

// Find the Driver document associated with the logged-in User.
async function findMyDriver(userId) {
  return Driver.findOne({ driverId: userId });
}

// Register an additional vehicle for the logged-in driver.
export async function registerVehicle(req, res, next) {
  let uploadedPhoto;

  try {
    const driver = await findMyDriver(req.user.id);

    if (!driver) {
      return res.status(404).json({
        message: "Driver profile not found",
      });
    }

    const {
      vehicleType,
      brand,
      model,
      year,
      color,
      crNumber,
      passengerSeats,
      airConditioning,
      luggageSpace,
      vehicleDescription,
      revenueLicenceExpiry,
      insuranceExpiry,
    } = req.body ?? {};

    const requiredFields = {
      vehicleType,
      brand,
      model,
      year,
      color,
      crNumber,
      passengerSeats,
      luggageSpace,
      revenueLicenceExpiry,
      insuranceExpiry,
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([, value]) =>
        value === undefined ||
        value === null ||
        String(value).trim() === ""
      )
      .map(([field]) => field);

    if (missingFields.length) {
      return res.status(400).json({
        message: "Required vehicle fields are missing",
        fields: missingFields,
      });
    }

    const normalizedType = String(vehicleType).trim().toLowerCase();
    const normalizedLuggage = String(luggageSpace).trim().toLowerCase();
    const normalizedCR = String(crNumber).trim().toUpperCase();

    if (!allowedTypes.includes(normalizedType)) {
      return res.status(400).json({
        message: "Invalid vehicle type",
      });
    }

    if (!["available", "limited", "unavailable"].includes(normalizedLuggage)) {
      return res.status(400).json({
        message: "Invalid luggage space option",
      });
    }

    const ac = String(airConditioning ?? "false").toLowerCase();

    if (!["true", "false"].includes(ac)) {
      return res.status(400).json({
        message: "airConditioning must be true or false",
      });
    }

    const parsedYear = Number(year);
    const parsedSeats = Number(passengerSeats);

    if (
      !Number.isInteger(parsedYear) ||
      parsedYear < 1900 ||
      parsedYear > new Date().getFullYear() + 1
    ) {
      return res.status(400).json({
        message: "Invalid vehicle year",
      });
    }

    if (
      !Number.isInteger(parsedSeats) ||
      parsedSeats < 1 ||
      parsedSeats > 100
    ) {
      return res.status(400).json({
        message: "Passenger seats must be a whole number between 1 and 100",
      });
    }

    function parseDate(value) {
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
      ) {
        return null;
      }

      const date = new Date(`${value}T00:00:00.000Z`);

      return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
        ? date
        : null;
    }

    const revenueExpiry = parseDate(revenueLicenceExpiry);
    const insuranceExpiryDate = parseDate(insuranceExpiry);

    if (!revenueExpiry || !insuranceExpiryDate) {
      return res.status(400).json({
        message: "Expiry dates must use YYYY-MM-DD format",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Vehicle photo is required",
      });
    }

    // Upload photo after validating the request.
    uploadedPhoto = await uploadVehiclePhoto(req.file.buffer);

    const vehicle = await Vehicle.create({
      driver: driver._id,
      vehicleType: normalizedType,
      brand: String(brand).trim(),
      model: String(model).trim(),
      year: parsedYear,
      color: String(color).trim(),
      crNumber: normalizedCR,
      passengerSeats: parsedSeats,
      airConditioning: ac === "true",
      luggageSpace: normalizedLuggage,
      vehicleDescription: String(vehicleDescription || "").trim(),
      revenueLicenceExpiry: revenueExpiry,
      insuranceExpiry: insuranceExpiryDate,
      vehiclePhotoUrl: uploadedPhoto.secure_url,
      vehiclePhotoPublicId: uploadedPhoto.public_id,
    });

    return res.status(201).json({
      message: "Vehicle registered successfully",
      vehicle,
    });
  } catch (error) {
    // Clean up the uploaded image if saving the vehicle fails.
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

// Get all vehicles belonging to the logged-in driver.
export async function getMyVehicles(req, res, next) {
  try {
    const driver = await findMyDriver(req.user.id);
    
   if (!driver) {
      return res.status(404).json({
        message: "Driver profile not found",
      });
    }

    const vehicles = await Vehicle.find({
      driver: driver._id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      count: vehicles.length,
      vehicles,
    });
  } catch (error) {
    next(error);
  }
}

//update vehicle



// Delete a vehicle belonging to the logged-in driver.
export async function deleteMyVehicle(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid vehicle ID",
      });
    }

    const driver = await findMyDriver(req.user.id);

    if (!driver) {
      return res.status(404).json({
        message: "Driver profile not found",
      });
    }

    const vehicle = await Vehicle.findOne({
      _id: req.params.id,
      driver: driver._id,
    }).select("+vehiclePhotoPublicId");

    if (!vehicle) {
      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    await vehicle.deleteOne();

    if (vehicle.vehiclePhotoPublicId) {
      try {
        await cloudinary.uploader.destroy(
          vehicle.vehiclePhotoPublicId
        );
      } catch (cleanupError) {
        console.error(
          "Vehicle photo deletion failed:",
          cleanupError.message
        );
      }
    }

    return res.status(200).json({
      message: "Vehicle deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}
