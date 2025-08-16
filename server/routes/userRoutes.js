import express from 'express'
import { checkAuth, login, signup, updateProfile } from '../controllers/userController.js';
import { protectRoute } from '../middleware/auth.js';
import passport from 'passport';


const userRouter = express.Router();
userRouter.post("/signup", signup);
userRouter.post("/login", login);
userRouter.put("/update-profile", protectRoute, updateProfile);
userRouter.get("/check", protectRoute, checkAuth);


userRouter.get(
  "/google",
  passport.authenticate("google", {
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/contacts.readonly"
    ],
    accessType: "offline",  // ask for refresh token
    prompt: "consent"       // force Google to show consent (gets refresh on first time)
  })
);

// -------- Google OAuth: callback --------
userRouter.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  async (req, res) => {
    try {
      // At this point, Passport has verified the user.
      // If you capture tokens in passport strategy, save them to session here.
      // If not, you can exchange code manually. Since we're using passport,
      // put tokens onto the session from req.user if you saved them there.
      // Fallback: just keep user logged in and redirect to your frontend UI.
      res.redirect("http://localhost:3000/contacts"); // your frontend page
    } catch (e) {
      console.error(e);
      res.redirect("/login");
    }
  }
);

// -------- Fetch contacts for the logged-in user --------
userRouter.get("/google/contacts", async (req, res) => {
  try {
    // We expect to have tokens saved on the session OR fetch them from DB.
    // If you saved tokens in req.user (via passport), you can use them directly.
    const { googleAccessToken, googleRefreshToken } = req.user || {};

    if (!googleAccessToken && !googleRefreshToken) {
      return res.status(401).json({ message: "Google not connected for this user" });
    }

    const oauth2Client = makeOAuthClient();
    oauth2Client.setCredentials({
      access_token: googleAccessToken,
      refresh_token: googleRefreshToken,
    });

    const people = google.people({ version: "v1", auth: oauth2Client });

    const response = await people.people.connections.list({
      resourceName: "people/me",
      pageSize: 200, // adjust as needed
      personFields: "names,emailAddresses,phoneNumbers,photos",
    });

    const connections = response.data.connections || [];

    const normalized = connections.map((c) => ({
      name: c.names?.[0]?.displayName || "",
      email: c.emailAddresses?.[0]?.value || "",
      phone: c.phoneNumbers?.[0]?.value || "",
      avatar: c.photos?.[0]?.url || "",
    }));

    res.json({ contacts: normalized, nextPageToken: response.data.nextPageToken || null });
  } catch (err) {
    console.error("Contacts fetch error:", err.response?.data || err.message);
    res.status(500).json({ message: "Failed to fetch contacts" });
  }
});





export default userRouter;