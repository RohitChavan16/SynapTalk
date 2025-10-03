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
  socialLinks: [
  {
    platform: { type: String, required: true },
    url: { type: String, required: true },
    isVisible: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    msgCount: { type: String, default: 0},
    lastUpdated: { type: Date, default: Date.now },
  }
],
  groups : [{ type: mongoose.Schema.Types.ObjectId, ref : "Group"}],
  publicKey: { type: String, required: true },  // ECC public key
  privateKey: { type: String, default: null },  
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;
