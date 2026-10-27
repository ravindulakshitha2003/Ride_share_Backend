
import Vehicle from "../models/Vehicle.js";
import User from "../models/User.js";

const allowedTypes = [
  "car",
  "van",
  "motorcycle",
  "three_wheeler",
];

export async function registerVehicle(req, res, next) {
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

    if (
      typeof registrationNumber !== "string" ||
      !registrationNumber.trim() ||
      typeof make !== "string" ||
      !make.trim() ||
      typeof model !== "string" ||
      !model.trim() ||
      typeof color !== "string" ||
      !color.trim() ||
      !Number.isInteger(year) ||
      !Number.isInteger(seats) ||
      !allowedTypes.includes(vehicleType)
    ) {
      return res.status(400).json({
        message: "Please provide valid vehicle details",
      });
    }

    if (
      year < 1900 ||
      year > new Date().getFullYear() + 1 ||
      seats < 1 ||
      seats > 100
    ) {
      return res.status(400).json({
        message: "Invalid vehicle year or seat count",
      });
    }

    // Ensure the driver account still exists.
    const driver = await User.findOne({
      _id: req.user.id,
      role: "driver",
    });

    if (!driver) {
      return res.status(403).json({
        message: "Driver account not found",
      });
    }

    const vehicle = await Vehicle.create({
      driver: driver._id,
      registrationNumber: registrationNumber.trim().toUpperCase(),
      make: make.trim(),
      model: model.trim(),
      year,
      color: color.trim(),
      vehicleType,
      seats,
    });

    return res.status(201).json({
      message: "Vehicle registered successfully",
      vehicle,
    });
  } catch (error) {
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
    const vehicle = await Vehicle.findOneAndDelete({
      _id: req.params.id,
      driver: req.user.id,
    });

    if (!vehicle) {
      return res.status(404).json({
        message: "Vehicle not found",
      });
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
