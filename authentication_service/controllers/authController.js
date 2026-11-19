import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import cloudinary from "../cloudinary.js";
import { generateOtp, hashOtp, OTP_TTL_MS, MAX_OTP_ATTEMPTS } from '../utils/otp.js';
import { sendEmail } from '../utils/email.js';
import { sendVerificationCode } from "../utils/verification.js";

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
      confirmPassword,
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

    // Validate confirm password
    if (
      typeof confirmPassword !== "string" ||
      !confirmPassword
    ) {
      return res.status(400).json({
        message: "Confirm password is required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Password and confirm password do not match",
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

    /*return res.status(201).json({
      message: "Registration successful",
      user: publicUser(user),
      token: createToken(user),
    });*/

        // A failed email must not undo the registration. The user can
    // request a new code with /auth/resend-verification.
    try {
      await sendVerificationCode(user);
    } catch (emailError) {
      console.error("Verification email failed:", emailError.message);
    }

    return res.status(201).json({
      message:
        "Registration successful. Check your email for the verification code.",
      user: publicUser(user),
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

   if (!user.emailVerified) {
      return res.status(403).json({
        message: "Please verify your email first",
        code: "EMAIL_NOT_VERIFIED",
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

export async function deleteMyAccount(req, res, next) {
  try {
    // Find the authenticated passenger.
    const user = await User.findById(req.user.id)
      .select("+passwordHash +profilePhotoPublicId");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // This first implementation is for normal passenger accounts only.
    if (user.role !== "passenger") {
      return res.status(403).json({
        message: "This endpoint is currently available for passenger accounts only",
      });
    }

    // Require password confirmation before deleting the account.
    const { password } = req.body ?? {};

    if (typeof password !== "string" || !password) {
      return res.status(400).json({
        message: "Password is required to delete your account",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Incorrect password",
      });
    }

    const profilePhotoPublicId = user.profilePhotoPublicId;

    // Delete the user account.
    await user.deleteOne();

    // Delete the profile photo from Cloudinary.
    if (profilePhotoPublicId) {
      try {
        await cloudinary.uploader.destroy(profilePhotoPublicId);
      } catch (cloudinaryError) {
        console.error(
          "Profile photo deletion failed:",
          cloudinaryError.message
        );
      }
    }

    return res.status(200).json({
      message: "Your account has been deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}



export async function updateMyAccount(req, res, next) {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

     let emailChanged = false;

    const { name, mobile, email, gender, dateOfBirth } =
      req.body ?? {};

    // Update name
    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100
      ) {
        return res.status(400).json({
          message: "Invalid name",
        });
      }

      user.name = name.trim();
    }

    // Update mobile
    if (mobile !== undefined) {
      if (typeof mobile !== "string") {
        return res.status(400).json({
          message: "Invalid mobile number",
        });
      }

      const trimmedMobile = mobile.trim();

      if (!/^(?:0\d{9}|\+94\d{9})$/.test(trimmedMobile)) {
        return res.status(400).json({
          message: "Enter a valid Sri Lankan mobile number",
        });
      }

      const normalizedMobile = normalizeMobile(trimmedMobile);

      const existingMobile = await User.findOne({
        mobile: normalizedMobile,
        _id: { $ne: user._id },
      });

      if (existingMobile) {
        return res.status(409).json({
          message: "Mobile number already registered",
        });
      }

      user.mobile = normalizedMobile;
    }

    // Update email
    if (email !== undefined) {
      if (typeof email !== "string") {
        return res.status(400).json({
          message: "Invalid email address",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
        normalizedEmail.length > 254
      ) {
        return res.status(400).json({
          message: "Enter a valid email address",
        });
      }

      const existingEmail = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: user._id },
      });

      if (existingEmail) {
        return res.status(409).json({
          message: "Email already registered",
        });
      }

      if (normalizedEmail !== user.email) {
        user.email = normalizedEmail;
        user.emailVerified = false;
        emailChanged = true;
      };
    }

    // Update gender
    if (gender !== undefined) {
      if (
        !["male", "female", "prefer_not_to_say"].includes(gender)
      ) {
        return res.status(400).json({
          message: "Invalid gender value",
        });
      }

      user.gender = gender;
    }

    // Update date of birth
    if (dateOfBirth !== undefined) {
      if (dateOfBirth === "") {
        user.dateOfBirth = undefined;
      } else {
        if (
          typeof dateOfBirth !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
        ) {
          return res.status(400).json({
            message: "Date of birth must use YYYY-MM-DD format",
          });
        }

        const parsedDate = new Date(
          `${dateOfBirth}T00:00:00.000Z`
        );

        if (
          Number.isNaN(parsedDate.getTime()) ||
          parsedDate.toISOString().slice(0, 10) !== dateOfBirth ||
          parsedDate > new Date()
        ) {
          return res.status(400).json({
            message: "Invalid date of birth",
          });
        }

        user.dateOfBirth = parsedDate;
      }
    }

    // Update profile photo
    if (req.file) {
      const uploadedPhoto = await uploadPhoto(req.file.buffer);

      user.profilePhotoUrl = uploadedPhoto.secure_url;
      user.profilePhotoPublicId = uploadedPhoto.public_id;
    }

    await user.save();

    if (emailChanged) {
      try {
        await sendVerificationCode(user);
      } catch (emailError) {
        console.error("Verification email failed:", emailError.message);
      }
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      user: publicUser(user),
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email or mobile number already registered",
      });
    }

    next(error);
  }
}

export async function verifyEmail(req, res, next) {
  try {
    const { email, otp } = req.body ?? {};

    if (typeof email !== "string" || !otp) {
      return res.status(400).json({
        message: "Email and code are required",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+emailOtpHash +emailOtpExpires +emailOtpAttempts");

    if (
      !user ||
      !user.emailOtpHash ||
      user.emailOtpExpires < Date.now()
    ) {
      return res.status(400).json({
        message: "Invalid or expired code",
      });
    }

    if (user.emailOtpAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        message: "Too many attempts. Request a new code.",
      });
    }

    if (hashOtp(String(otp).trim()) !== user.emailOtpHash) {
      user.emailOtpAttempts += 1;
      await user.save();
      return res.status(400).json({
        message: "Invalid or expired code",
      });
    }

    user.emailVerified = true;
    user.emailOtpHash = undefined;
    user.emailOtpExpires = undefined;
    user.emailOtpAttempts = 0;
    await user.save();

    return res.status(200).json({
      message: "Email verified",
      user: publicUser(user),
      token: createToken(user),
    });
  } catch (error) {
    next(error);
  }
}

export async function resendVerification(req, res, next) {
  try {
    const { email } = req.body ?? {};

    if (typeof email === "string") {
      const user = await User.findOne({
        email: email.trim().toLowerCase(),
      });

      if (user && !user.emailVerified) {
        try {
          await sendVerificationCode(user);
        } catch (emailError) {
          console.error("Verification email failed:", emailError.message);
        }
      }
    }

    // Same response whether or not the account exists
    return res.status(200).json({
      message:
        "If the account exists and is unverified, a new code has been sent.",
    });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body ?? {};

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Enter a valid email address",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (user) {
      try {
        const otp = generateOtp();
        user.resetOtpHash = hashOtp(otp);
        user.resetOtpExpires = Date.now() + OTP_TTL_MS;
        user.resetOtpAttempts = 0;
        await user.save();

        await sendEmail({
          to: user.email,
          subject: "Share-Ride password reset",
          text: `Your reset code is ${otp}. It expires in 15 minutes. If you didn't request this, ignore this email.`,
        });
      } catch (emailError) {
        console.error("Reset email failed:", emailError.message);
      }
    }

    // Same response whether or not the account exists
    return res.status(200).json({
      message: "If that email is registered, a reset code has been sent.",
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { email, otp, newPassword } = req.body ?? {};

    if (
      typeof email !== "string" ||
      !otp ||
      typeof newPassword !== "string" ||
      newPassword.length < 8
    ) {
      return res.status(400).json({
        message:
          "Email, code and a new password of at least 8 characters are required",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+resetOtpHash +resetOtpExpires +resetOtpAttempts");

    if (
      !user ||
      !user.resetOtpHash ||
      user.resetOtpExpires < Date.now()
    ) {
      return res.status(400).json({
        message: "Invalid or expired code",
      });
    }

    if (user.resetOtpAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        message: "Too many attempts. Request a new code.",
      });
    }

    if (hashOtp(String(otp).trim()) !== user.resetOtpHash) {
      user.resetOtpAttempts += 1;
      await user.save();
      return res.status(400).json({
        message: "Invalid or expired code",
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.resetOtpHash = undefined;
    user.resetOtpExpires = undefined;
    user.resetOtpAttempts = 0;
    await user.save();

    return res.status(200).json({
      message: "Password updated. You can now log in.",
    });
  } catch (error) {
    next(error);
  }
}