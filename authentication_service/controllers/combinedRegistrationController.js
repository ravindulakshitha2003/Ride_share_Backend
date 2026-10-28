
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import Driver from "../models/Driver.js";
import Vehicle from "../models/Vehicle.js";
import cloudinary from "../cloudinary.js";

function normalizeMobile(value) {
  const mobile = String(value || "").trim();

  // Normalize Sri Lankan local mobile numbers.
  if (/^0\d{9}$/.test(mobile)) {
    return `+94${mobile.slice(1)}`;
  }

  return mobile;
}

function createToken(user) {
  return jwt.sign(
    {
      name: user.name,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      subject: user._id.toString(),
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    }
  );
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    mobile: user.mobile,
    email: user.email,
    role: user.role,
    gender: user.gender,
    dateOfBirth: user.dateOfBirth
      ? user.dateOfBirth.toISOString()
      : undefined,
    profilePhotoUrl: user.profilePhotoUrl,
  };
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

function uploadPhoto(file, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Photo upload failed"));

        resolve(result);
      }
    );

    stream.end(file.buffer);
  });
}

async function deleteCloudinaryPhotos(publicIds) {
  await Promise.allSettled(
    publicIds.map((publicId) =>
      cloudinary.uploader.destroy(publicId)
    )
  );
}

export async function registerDriverWithVehicle(req, res, next) {
  const uploadedPublicIds = [];
  const session = await mongoose.startSession();

  let transactionStarted = false;

  try {
    const {
      // User details
      name,
      mobile,
      email,
      password,
      gender,
      dateOfBirth,

      // Driver details
      nicNumber,
      drivingLicenceNumber,
      licenceClass,
      licenceExpiryDate,
      address,
      emergencyContactName,
      emergencyContactPhone,

      // Vehicle details
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
    } = req.body;

    // Both images are required.
    const profilePhoto = req.files?.profilePhoto?.[0];
    const vehiclePhoto = req.files?.vehiclePhoto?.[0];

    const requiredFields = {
      name,
      mobile,
      email,
      password,
      nicNumber,
      drivingLicenceNumber,
      licenceClass,
      licenceExpiryDate,
      address,
      emergencyContactName,
      emergencyContactPhone,
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
        message: "Required registration fields are missing",
        fields: missingFields,
      });
    }

    if (!profilePhoto || !vehiclePhoto) {
      return res.status(400).json({
        message: "Both profilePhoto and vehiclePhoto are required",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedMobile = normalizeMobile(mobile);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
  return res.status(400).json({
    message: "Enter a valid email address",
  });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters",
      });
    }

    const parsedDOB = dateOfBirth ? parseDate(dateOfBirth) : null;

    if (dateOfBirth && !parsedDOB) {
      return res.status(400).json({
        message: "Date of birth must use YYYY-MM-DD format",
      });
    }

    if (parsedDOB && parsedDOB > new Date()) {
      return res.status(400).json({
        message: "Date of birth cannot be in the future",
      });
    }

    const classes = (
      Array.isArray(licenceClass)
        ? licenceClass
        : String(licenceClass).split(",")
    )
      .map((item) => String(item).trim())
      .filter(Boolean);

    const licenceExpiryDateValue = parseDate(licenceExpiryDate);
    const revenueExpiryValue = parseDate(revenueLicenceExpiry);
    const insuranceExpiryValue = parseDate(insuranceExpiry);

    if (
      !licenceExpiryDateValue ||
      !revenueExpiryValue ||
      !insuranceExpiryValue
    ) {
      return res.status(400).json({
        message: "All licence and insurance expiry dates must use YYYY-MM-DD",
      });
    }

    const normalizedVehicleType = String(vehicleType).toLowerCase().trim();
    const normalizedLuggage = String(luggageSpace).toLowerCase().trim();
    const ac = String(airConditioning ?? "false").toLowerCase();

    if (!["car", "van", "suv", "other"].includes(normalizedVehicleType)) {
      return res.status(400).json({ message: "Invalid vehicle type" });
    }

    if (!["available", "limited", "unavailable"].includes(normalizedLuggage)) {
      return res.status(400).json({ message: "Invalid luggage space option" });
    }

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
      return res.status(400).json({ message: "Invalid vehicle year" });
    }

    if (!Number.isInteger(parsedSeats) || parsedSeats < 1 || parsedSeats > 100) {
      return res.status(400).json({
        message: "Passenger seats must be a whole number between 1 and 100",
      });
    }

    // Check common duplicates before uploading photos.
    const normalizedNIC = String(nicNumber).trim();
    const normalizedLicence = String(drivingLicenceNumber).trim();
    const normalizedCR = String(crNumber).trim().toUpperCase();

    const [existingUser, existingDriver, existingVehicle] =
      await Promise.all([
        User.findOne({
          $or: [
            { email: normalizedEmail },
            { mobile: normalizedMobile },
          ],
        }),
        Driver.findOne({
          $or: [
            { nicNumber: normalizedNIC },
            { drivingLicenceNumber: normalizedLicence },
          ],
        }),
        Vehicle.findOne({ crNumber: normalizedCR }),
      ]);

    if (existingUser) {
      return res.status(409).json({
        message: "Email or mobile number is already registered",
      });
    }

    if (existingDriver) {
      return res.status(409).json({
        message: "NIC or driving licence number is already registered",
      });
    }

    if (existingVehicle) {
      return res.status(409).json({
        message: "Vehicle registration number is already registered",
      });
    }

    // Upload images. These uploads are outside the MongoDB transaction.
    const [profileImage, vehicleImage] = await Promise.all([
      uploadPhoto(profilePhoto, "share-ride/profiles"),
      uploadPhoto(vehiclePhoto, "share-ride/vehicles"),
    ]);

    uploadedPublicIds.push(
      profileImage.public_id,
      vehicleImage.public_id
    );

    const passwordHash = await bcrypt.hash(password, 12);

    // MongoDB transactions require a replica set or supported sharded cluster.
    session.startTransaction();
    transactionStarted = true;

    const [user] = await User.create(
      [
        {
          name: String(name).trim(),
          mobile: normalizedMobile,
          email: normalizedEmail,
          passwordHash,
          role: "driver",
          ...(gender ? { gender } : {}),
          ...(parsedDOB ? { dateOfBirth: parsedDOB } : {}),
          profilePhotoUrl: profileImage.secure_url,
          profilePhotoPublicId: profileImage.public_id,
        },
      ],
      { session }
    );

    const [driver] = await Driver.create(
      [
        {
          driverId: user._id,
          nicNumber: normalizedNIC,
          drivingLicenceNumber: normalizedLicence,
          licenceClass: classes,
          licenceExpiryDate: licenceExpiryDateValue,
          address: String(address).trim(),
          emergencyContactName: String(emergencyContactName).trim(),
          emergencyContactPhone: String(emergencyContactPhone).trim(),
          verificationStatus: "pending",
        },
      ],
      { session }
    );

    const [vehicle] = await Vehicle.create(
      [
        {
          driver: driver._id,
          vehicleType: normalizedVehicleType,
          brand: String(brand).trim(),
          model: String(model).trim(),
          year: parsedYear,
          color: String(color).trim(),
          crNumber: normalizedCR,
          passengerSeats: parsedSeats,
          airConditioning: ac === "true",
          luggageSpace: normalizedLuggage,
          vehicleDescription: String(vehicleDescription || "").trim(),
          revenueLicenceExpiry: revenueExpiryValue,
          insuranceExpiry: insuranceExpiryValue,
          vehiclePhotoUrl: vehicleImage.secure_url,
          vehiclePhotoPublicId: vehicleImage.public_id,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    transactionStarted = false;

    return res.status(201).json({
      message: "Driver account and vehicle registered successfully",
      token: createToken(user),
      user: publicUser(user),
      driver,
      vehicle,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error("Transaction rollback failed:", abortError.message);
      }
    }

    if (uploadedPublicIds.length) {
      await deleteCloudinaryPhotos(uploadedPublicIds);
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: "A unique value such as email, mobile, NIC, licence or CR number is already registered",
      });
    }

    next(error);
  } finally {
    await session.endSession();
  }
}
