import crypto from "crypto";
import User from "../models/User.js";
import Otp from "../models/Otp.js";
import bcrypt from "bcryptjs"; 
import { sendConfirmationEmail } from "../utils/sendConfirmationEmail.js";
import AppError from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";

const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

export const sendVerificationOTP = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new AppError("Email is required", 400));
  }

  await Otp.deleteMany({ email, type: "verifyEmail" });

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); 

  await Otp.create({
    email,
    otp,
    type: "verifyEmail",
    expiresAt,
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 32px; font-weight: bold; color: #6366f1; }
        .otp-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; }
        .otp-code { font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 10px 0; }
        .content { color: #333; line-height: 1.6; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🎥 SynapTalk</div>
        </div>
        <div class="content">
          <h2>Email Verification</h2>
          <p>Hello,</p>
          <p>You requested to verify your email address. Use the OTP below to complete your verification:</p>
        </div>
        <div class="otp-box">
          <p style="margin: 0; font-size: 14px;">Your Verification Code</p>
          <div class="otp-code">${otp}</div>
          <p style="margin: 0; font-size: 12px;">Valid for 10 minutes</p>
        </div>
        <div class="content">
          <p>If you didn't request this verification, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>© 2025 SynapTalk. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendConfirmationEmail(email, "Verify Your Email - SynapTalk", htmlContent);

  res.status(200).json({
    success: true,
    message: "OTP sent successfully to your email",
  });
});

export const verifyEmailOTP = catchAsync(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return next(new AppError("Email and OTP are required", 400));
  }

  const otpRecord = await Otp.findOne({
    email,
    otp,
    type: "verifyEmail",
  });

  if (!otpRecord) {
    return next(new AppError("Invalid OTP", 400));
  }

  if (otpRecord.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: otpRecord._id });
    return next(new AppError("OTP has expired", 400));
  }

  const user = await User.findOneAndUpdate(
    { email },
    { new: true }
  );

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  await Otp.deleteOne({ _id: otpRecord._id });

  res.status(200).json({
    success: true,
    message: "Email verified successfully",
    user: {
      id: user._id,
      email: user.email,
      isVerified: user.isVerified,
    },
  });
});

export const sendPasswordResetOTP = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new AppError("Email is required", 400));
  }

  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  await Otp.deleteMany({ email, type: "resetPassword" });

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); 

  await Otp.create({
    email,
    otp,
    type: "resetPassword",
    expiresAt,
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 32px; font-weight: bold; color: #6366f1; }
        .otp-box { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; }
        .otp-code { font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 10px 0; }
        .content { color: #333; line-height: 1.6; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">SynapTalk</div>
        </div>
        <div class="content">
          <h2>Password Reset Request</h2>
          <p>Hello,</p>
          <p>You requested to reset your password. Use the OTP below to proceed:</p>
        </div>
        <div class="otp-box">
          <p style="margin: 0; font-size: 14px;">Your Reset Code</p>
          <div class="otp-code">${otp}</div>
          <p style="margin: 0; font-size: 12px;">Valid for 10 minutes</p>
        </div>
        <div class="warning">
          <strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email and secure your account.
        </div>
        <div class="footer">
          <p>© 2025 SynapTalk. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendConfirmationEmail(email, "Password Reset OTP - SynapTalk", htmlContent);

  res.status(200).json({
    success: true,
    message: "Password reset OTP sent to your email",
  });
});

export const verifyPasswordResetOTP = catchAsync(async (req, res, next) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return next(new AppError("Email, OTP, and new password are required", 400));
  }

  if (newPassword.length < 8) {
    return next(new AppError("Password must be at least 8 characters long", 400));
  }

  const otpRecord = await Otp.findOne({
    email,
    otp,
    type: "resetPassword",
  });

  if (!otpRecord) {
    return next(new AppError("Invalid OTP", 400));
  }

  if (otpRecord.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: otpRecord._id });
    return next(new AppError("OTP has expired", 400));
  }

  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  const salt = await bcrypt.genSalt(10);
  const hashPassword = await bcrypt.hash(newPassword, salt);
  user.password = hashPassword;
  await user.save();

  await Otp.deleteOne({ _id: otpRecord._id });

  res.status(200).json({
    success: true,
    message: "Password reset successfully",
  });
});