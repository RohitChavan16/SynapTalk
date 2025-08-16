import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js"; // your mongoose model

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:5001/api/auth/google/callback",
      passReqToCallback: true, // so we can access req in verify callback if needed
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          user = await User.create({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails?.[0]?.value,
            profilePic: profile.photos?.[0]?.value,
            googleAccessToken: accessToken,
            googleRefreshToken: refreshToken || null,
          });
        } else {
          // Update tokens if changed/new
          user.googleAccessToken = accessToken;
          if (refreshToken) user.googleRefreshToken = refreshToken;
          await user.save();
        }

        // Expose tokens in session user object
        const safeUser = user.toObject();
        safeUser.googleAccessToken = accessToken;
        safeUser.googleRefreshToken = refreshToken || user.googleRefreshToken || null;

        return done(null, safeUser);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user._id || user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).lean();
    done(null, user);
  } catch (e) {
    done(e);
  }
});

export default passport;
