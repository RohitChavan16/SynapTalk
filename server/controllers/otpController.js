 // Adjust path as needed
import crypto from "crypto";
import User from "../models/User.js";
import Otp from "../models/Otp.js";
import bcrypt from "bcryptjs"; 
import { sendConfirmationEmail } from "../utils/sendConfirmationEmail.js";

// Generate 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

export const sendVerificationOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // Delete any existing OTPs for this email and type
    await Otp.deleteMany({ email, type: "verifyEmail" });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

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
  } catch (error) {
    console.error("Error sending verification OTP:", error);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};








export const verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    const otpRecord = await Otp.findOne({
      email,
      otp,
      type: "verifyEmail",
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: "OTP has expired" });
    }

    const user = await User.findOneAndUpdate(
      { email },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
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
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ success: false, message: "Failed to verify OTP" });
  }
};











// Send OTP for Password Reset
export const sendPasswordResetOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await Otp.deleteMany({ email, type: "resetPassword" });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

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
  } catch (error) {
    console.error("Error sending password reset OTP:", error);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};












// Verify OTP and Reset Password
export const verifyPasswordResetOTP = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    const otpRecord = await Otp.findOne({
      email,
      otp,
      type: "resetPassword",
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: "OTP has expired" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
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
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ success: false, message: "Failed to reset password" });
  }
};