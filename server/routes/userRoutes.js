import express from 'express';
import { addSocialLink, checkAuth, deleteSocialLink, editSocialLink, getSocialLink, login, signup, updateProfile } from '../controllers/userController.js';
import { protectRoute } from '../middleware/auth.js';
import passport from "passport";
import { google } from "googleapis";
import { generateToken } from "../utils/jwtToken.js";
import User from '../models/User.js';
import jwt from "jsonwebtoken";
const userRouter = express.Router();

// Standard auth routes
userRouter.post("/signup", signup);
userRouter.post("/login", login);
userRouter.put("/update-profile", protectRoute, updateProfile);
userRouter.get("/check", protectRoute, checkAuth);

userRouter.get("/social-links", protectRoute, getSocialLink);
userRouter.post("/add-links", protectRoute, addSocialLink);
userRouter.delete("/delete-links", protectRoute, deleteSocialLink);
userRouter.put("/edit-links", protectRoute, editSocialLink);

// Google OAuth login
userRouter.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email", "https://www.googleapis.com/auth/contacts.readonly"],
    accessType: "offline",
    prompt: "consent",
  })
);

// Google callback
userRouter.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    const token = generateToken(req.user._id); // server JWT

    res.redirect(`http://localhost:5173/?token=${token}`);
  }
);

// Google contacts API
userRouter.get("/google/contacts", async (req, res) => {
  try {
    console.log("Incoming headers:", req.headers);

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log("❌ No Authorization header");
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    console.log("Extracted JWT:", token);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded JWT:", decoded);

    const user = await User.findById(decoded.userId);
    if (!user) {
      console.log("❌ User not found");
      return res.status(401).json({ message: "User not found" });
    }

    if (!user.googleAccessToken) {
      console.log("❌ Missing Google Access Token");
      return res.status(400).json({ message: "Google login required" });
    }

    console.log("✅ Google tokens found");

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    console.log("✅ OAuth2 client set");

    const people = google.people({ version: "v1", auth: oauth2Client });
    const response = await people.people.connections.list({
      resourceName: "people/me",
      pageSize: 20,
      personFields: "names,emailAddresses,phoneNumbers,photos",
    });

    console.log("✅ Google response:", response.data);

    const contacts = (response.data.connections || []).map((c) => ({
      name: c.names?.[0]?.displayName || "",
      email: c.emailAddresses?.[0]?.value || "",
      phone: c.phoneNumbers?.[0]?.value || "",
      avatar: c.photos?.[0]?.url || "",
    }));

    res.json({ contacts });
  } catch (err) {
    console.error("🔥 ERROR in /google/contacts:", err);
    res.status(500).json({ message: "Failed to fetch contacts", error: err.message });
  }
});



export default userRouter;
