import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  fullName: { type: String, required: function() { return !this.isOAuthUser; } },
  password: { type: String, required: function() { return !this.isOAuthUser; }, minlength: 6 },
  googleId: { type: String, default: null, unique: true, sparse: true },
  profilePic: { type: String, default: "" },
  isOAuthUser: { type: Boolean, default: false },
  lastLogin: { type: Date, default: null },
  bio: { type: String },
  location: { type: String },
  googleAccessToken: { type: String, default: null },
  googleRefreshToken: { type: String, default: null },
  socialLinks: {
    linkedin: { type: String, default: "" },
    youtube: { type: String, default: "" },
    twitter: { type: String, default: "" },
    instagram: { type: String, default: "" },
    facebook: { type: String, default: "" },
    github: { type: String, default: "" },
    personalWebsite: { type: String, default: "" },
  },
  groups : [{ type: mongoose.Schema.Types.ObjectId, ref : "Group"}],
  publicKey: { type: String, required: true },  // ECC public key
  privateKey: { type: String, default: null },  
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;
