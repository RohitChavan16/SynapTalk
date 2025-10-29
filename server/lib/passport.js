import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";
import { generateToken } from "../utils/jwtToken.js";
import { generateKeyPair } from "../crypto/crypto.js";

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
        
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          user = await User.findOne({ email: profile.emails[0].value });
          if (user) {
           
            user.googleId = profile.id;
            user.googleAccessToken = accessToken;
            user.googleRefreshToken = refreshToken || null;
            user.isOAuthUser = true;
            await user.save();
          } else {
            // create new Google user
            const { publicKey, privateKey } = generateKeyPair();

            user = await User.create({
              googleId: profile.id,
              fullName: profile.displayName || "Google User",
              email: profile.emails[0].value,
              googleAccessToken: accessToken,
              googleRefreshToken: refreshToken || null,
              isOAuthUser: true,
              publicKey,
              privateKey, // ✅ Store temporarily to send to client
            });
          }
        } else {
          
          user.googleAccessToken = accessToken;
          if (refreshToken) user.googleRefreshToken = refreshToken;
          await user.save();
        }
         
        const safeUser = user.toObject();
        safeUser.googleAccessToken = accessToken;
        safeUser.googleRefreshToken = refreshToken || user.googleRefreshToken || null;

        const token = generateToken(user._id);
        safeUser.token = token; 

        done(null, safeUser);
      } catch (err) {
        console.error("❌ Google OAuth error:", err);
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
