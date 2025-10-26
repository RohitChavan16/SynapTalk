
import express from "express";
import { sendVerificationOTP, verifyEmailOTP, sendPasswordResetOTP, verifyPasswordResetOTP } from "../controllers/otpController.js";

const otpRouter = express.Router();

// Email Verification Routes
otpRouter.post("/send-verification-otp", sendVerificationOTP);
otpRouter.post("/verify-email-otp", verifyEmailOTP);

// Password Reset Routes
otpRouter.post("/send-reset-otp", sendPasswordResetOTP);
otpRouter.post("/verify-reset-otp", verifyPasswordResetOTP);

export default otpRouter;