import { generateOtp, hashOtp, OTP_TTL_MS } from "./otp.js";
import { sendEmail } from "./email.js";

export async function sendVerificationCode(user) {
  const otp = generateOtp();
  user.emailOtpHash = hashOtp(otp);
  user.emailOtpExpires = Date.now() + OTP_TTL_MS;
  user.emailOtpAttempts = 0;
  await user.save();

  await sendEmail({
    to: user.email,
    subject: "Verify your Share-Ride email",
    text: `Your verification code is ${otp}. It expires in 15 minutes.`,
  });
}