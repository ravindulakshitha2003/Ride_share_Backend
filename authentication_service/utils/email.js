import nodemailer from 'nodemailer';

// Works with any SMTP server. For Resend:
//   SMTP_HOST=smtp.resend.com  SMTP_PORT=465  SMTP_USER=resend  SMTP_PASS=<your Resend API key>
const port = Number(process.env.SMTP_PORT) || 587;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  // Ports 465 and 2465 use SSL from the start; 587/2587/25 upgrade with STARTTLS.
  secure: port === 465 || port === 2465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export const sendEmail = ({ to, subject, text }) =>
  transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
