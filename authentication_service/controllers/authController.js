import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import cloudinary from "../cloudinary.js";

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
    id: user._id.toString(),
    name: user.name,
    mobile: user.mobile,
    email: user.email,
    role: user.role,
    gender: user.gender ?? null,
    dateOfBirth: user.dateOfBirth
      ? user.dateOfBirth.toISOString().slice(0, 10)
      : null,
    profilePhotoUrl: user.profilePhotoUrl ?? null,
  };
}

function normalizeMobile(mobile) {
  return mobile.startsWith("0")
    ? `+94${mobile.slice(1)}`
    : mobile;
}
 //handle photoUploading
function uploadPhoto(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "share-ride/profile-photos",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation: [
          { width: 800, height: 800, crop: "limit" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}



export async function register(req, res, next) {
  let uploadedPhoto;

  try {
    const {
      name,
      mobile,
      email,
      password,
      role,
      gender,
      dateOfBirth,
    } = req.body ?? {};

    // Validate required text fields
    if (
      typeof name !== "string" ||
      typeof mobile !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof role !== "string"
    ) {
      return res.status(400).json({
        message:
          "Name, mobile, email, password and role are required",
      });
    }

    // Profile photo is required
    if (!req.file) {
      return res.status(400).json({
        message: "Profile photo is required",
      });
    }

    const trimmedName = name.trim();
    const trimmedMobile = mobile.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // Validate role
    if (!["passenger", "driver"].includes(role)) {
      return res.status(400).json({
        message: "Role must be passenger or driver",
      });
    }

    // Validate name
    if (!trimmedName || trimmedName.length > 100) {
      return res.status(400).json({
        message: "Name must contain 1-100 characters",
      });
    }

    // Validate Sri Lankan mobile number
    // Accepts 0771234567 or +94771234567
    const mobileRegex = /^(?:0\d{9}|\+94\d{9})$/;

    if (!mobileRegex.test(trimmedMobile)) {
      return res.status(400).json({
        message: "Enter a valid Sri Lankan mobile number",
      });
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !emailRegex.test(normalizedEmail) ||
      normalizedEmail.length > 254
    ) {
      return res.status(400).json({
        message: "Enter a valid email address",
      });
    }

    // Validate password
    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters",
      });
    }

    // Validate optional gender
    const allowedGenders = [
      "male",
      "female",
      "prefer_not_to_say",
    ];

    if (
      gender !== undefined &&
      !allowedGenders.includes(gender)
    ) {
      return res.status(400).json({
        message: "Invalid gender value",
      });
    }

    // Validate optional date of birth
    let parsedDateOfBirth;

    if (dateOfBirth !== undefined && dateOfBirth !== "") {
      if (
        typeof dateOfBirth !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
      ) {
        return res.status(400).json({
          message: "Date of birth must use YYYY-MM-DD format",
        });
      }

      parsedDateOfBirth = new Date(
        `${dateOfBirth}T00:00:00.000Z`
      );

      if (
        Number.isNaN(parsedDateOfBirth.getTime()) ||
        parsedDateOfBirth.toISOString().slice(0, 10) !==
          dateOfBirth ||
        parsedDateOfBirth > new Date()
      ) {
        return res.status(400).json({
          message: "Enter a valid date of birth",
        });
      }
    }

    const normalizedMobile = normalizeMobile(trimmedMobile);

    // Check for duplicate email or mobile
    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { mobile: normalizedMobile },
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email or mobile number already registered",
      });
    }

    // Upload profile photo to Cloudinary
    uploadedPhoto = await uploadPhoto(req.file.buffer);

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create passenger or driver account
    const user = await User.create({
      name: trimmedName,
      mobile: normalizedMobile,
      email: normalizedEmail,
      passwordHash,
      role,
      ...(gender !== undefined ? { gender } : {}),
      ...(parsedDateOfBirth
        ? { dateOfBirth: parsedDateOfBirth }
        : {}),
      profilePhotoUrl: uploadedPhoto.secure_url,
      profilePhotoPublicId: uploadedPhoto.public_id,
    });

    return res.status(201).json({
      message: "Registration successful",
      user: publicUser(user),
      token: createToken(user),
    });
  } catch (error) {
    // Remove uploaded photo if account creation fails
    if (uploadedPhoto?.public_id) {
      try {
        await cloudinary.uploader.destroy(
          uploadedPhoto.public_id
        );
      } catch (cleanupError) {
        console.error(
          "Profile photo cleanup failed:",
          cleanupError.message
        );
      }
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email or mobile number already registered",
      });
    }

    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim()
    ) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+passwordHash");

    if (
      !user ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    return res.status(200).json({
      message: "Login successful",
      user: publicUser(user),
      token: createToken(user),
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
}