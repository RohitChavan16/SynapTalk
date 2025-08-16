import { google } from "googleapis";

export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,     // from Google Cloud Console
  process.env.GOOGLE_CLIENT_SECRET, // from Google Cloud Console
  process.env.GOOGLE_REDIRECT_URI   // must match Console redirect URI
);