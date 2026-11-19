import crypto from 'crypto';

export const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_OTP_ATTEMPTS = 5;

export const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

export const hashOtp = (otp) =>
  crypto.createHash('sha256').update(String(otp)).digest('hex');