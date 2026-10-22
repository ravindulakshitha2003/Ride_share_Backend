import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

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

// Never return passwordHash in API responses
function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    mobile: user.mobile,
    email: user.email,
    role: user.role,
  };
}

function normalizeMobile(mobile) {
  return mobile.startsWith("0")
    ? `+94${mobile.slice(1)}`
    : mobile;
}

export async function register(req, res, next) {
  try {
    const { name, mobile, email, password, role } = req.body ?? {};

    // Validate field types first
    if (
      typeof name !== "string" ||
      typeof mobile !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof role !== "string"
    ) {
      return res.status(400).json({
        message: "All fields are required and must have valid types",
      });
    }

    const trimmedName = name.trim();
    const trimmedMobile = mobile.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // Accept 0771234567 or +94771234567
    const mobileRegex = /^(?:0\d{9}|\+94\d{9})$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!mobileRegex.test(trimmedMobile)) {
      return res.status(400).json({
        message:
          "Enter a valid Sri Lankan mobile number, e.g. 0771234567 or +94771234567",
      });
    }

    if (
      !trimmedName ||
      trimmedName.length > 100 ||
      !emailRegex.test(normalizedEmail) ||
      normalizedEmail.length > 254 ||
      password.length < 8 ||
      !["driver", "passenger"].includes(role)
    ) {
      return res.status(400).json({
        message:
          "Invalid input. Check the name, email, password (minimum 8 characters), and role.",
      });
    }

    // Store both accepted mobile formats in the same format
    const normalizedMobile = normalizeMobile(trimmedMobile);

    // Check email and mobile uniqueness
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

    const passwordHash = await bcrypt.hash(password, 12);  //Hashes passwords with bcrypt.

    const user = await User.create({
      name: trimmedName,
      mobile: normalizedMobile,
      email: normalizedEmail,
      passwordHash,
      role,
    });

    return res.status(201).json({
      message: "Registration successful",
      user: publicUser(user),
      token: createToken(user),
    });
  } catch (error) {
    // Handle duplicate-key race conditions
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