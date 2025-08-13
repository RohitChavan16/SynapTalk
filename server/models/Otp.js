import mongoose from "mongoose"

const otpSchema = new mongoose.Schema({
email: {type: String, required: true},
otp: {type: String, default: ""},
type: {type: String, enum: ["verifyEmail", "resetPassword"], required: true},
expiresAt: {type: Date, required: true},
createdAt: {type: Date, default: Date.now, expires: 600},  // auto-delete after 10 minutes
}, {timestamps: true});

const Otp = mongoose.model("Otp", otpSchema);

export default Otp;