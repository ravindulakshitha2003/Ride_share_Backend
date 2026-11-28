import rateLimit from 'express-rate-limit';

// Each route gets its OWN limiter. (One shared limiter would count
// forgot-password, resend and verify requests together, so 5 taps
// anywhere would block every email route for 15 minutes.)
function makeLimiter(limit) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Try again later.' },
  });
}

// Routes that send an email: 5 per 15 minutes per IP address.
export const otpLimiter = makeLimiter(5);
export const signupCodeLimiter = makeLimiter(5);
export const resendLimiter = makeLimiter(5);
export const forgotLimiter = makeLimiter(5);

// Routes that check a code: a few more, for typing mistakes.
// (Each code also locks after 5 wrong attempts.)
export const verifySignupLimiter = makeLimiter(10);
export const verifyEmailLimiter = makeLimiter(10);
export const verifyResetLimiter = makeLimiter(10);
export const resetPasswordLimiter = makeLimiter(10);

// Google sign-in: 20 per 15 minutes per IP address.
export const googleLimiter = makeLimiter(20);
