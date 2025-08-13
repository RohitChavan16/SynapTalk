import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
email: {type: String, required: true},
fullName: {type: String, required: true},
password: {type: String, required: true, minlength: 6},
googleId: {type: String, default: null},
profilePic: {type: String, default: ""},
isOAuthUser: {type: Boolean, default: false},
lastLogin: {type: Date, default: null},
bio: {type: String},
location: {type: String},
socialLinks: {
    linkedin: {type: String, default: ""},
    youtube: {type: String, default: ""},
    twitter: {type: String, default: ""},
    instagram: {type: String, default: ""},
    facebook: {type: String, default: ""},
    github: {type: String, default: "" },
    personalWebsite: { type: String, default: ""}
  },
}, {timestamps: true});

const User = mongoose.model('User', userSchema);

export default User;