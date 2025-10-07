import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";
import { generateToken } from "../utils/jwtToken.js"; // your JWT generator

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_REDIRECT_URI, // must match Google console
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // 1️⃣ Check if user exists by googleId
        let user = await User.findOne({ googleId: profile.id });

        // 2️⃣ Link account by email if manual signup exists
        if (!user) {
          user = await User.findOne({ email: profile.emails[0].value });
          if (user) {
            // link Google account
            user.googleId = profile.id;
            user.googleAccessToken = accessToken;
            user.googleRefreshToken = refreshToken || null;
            user.isOAuthUser = true;
            await user.save();
          } else {
            // create new Google user
            user = await User.create({
              googleId: profile.id,
              fullName: profile.displayName || "Google User",
              email: profile.emails[0].value,
              googleAccessToken: accessToken,
              googleRefreshToken: refreshToken || null,
              isOAuthUser: true,
            });
          }
        } else {
          // update tokens if user already exists
          user.googleAccessToken = accessToken;
          if (refreshToken) user.googleRefreshToken = refreshToken;
          await user.save();
        }
         {/* profilePic: profile.photos?.[0]?.value, */}

        // return user object with JWT
        const safeUser = user.toObject();
        safeUser.googleAccessToken = accessToken;
        safeUser.googleRefreshToken = refreshToken || user.googleRefreshToken || null;

        // ✅ generate app JWT
        const token = generateToken(user._id);
        safeUser.token = token; // attach JWT

        done(null, safeUser);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

// Passport session
passport.serializeUser((user, done) => done(null, user._id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).lean();
    done(null, user);
  } catch (err) {
    done(err);
  }
});

export default passport;
