import jwt from "jsonwebtoken";
import User from "../models/User.js"; // ✅ make sure path is correct
import AppError from '../utils/AppError.js';
import logger from '../lib/logger.js'; // ✅ make sure path is correct

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Bearer token
    if (!token)
      return res.status(401).json({ success: false, message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });
    
    req.user = user;
    next();
  } catch (error) {
    logger.error("Authentication Error:", error.message);
    res.status(401).json({ success: false, message: error.message });
  }
};
