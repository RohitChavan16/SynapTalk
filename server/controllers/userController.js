import User from "../models/User.js";
import bcrypt from "bcryptjs"; 
import { generateToken } from "../utils/jwtToken.js";
import cloudinary from "../lib/cloudinary.js";
import { generateKeyPair } from "../crypto/crypto.js";

export const signup = async (req, res) => {
  const { fullName, email, password, bio } = req.body;

  try {
    if (!fullName || !email || !password || !bio) {
      return res.json({success: false, message: "Missing Details" });
    }

    const user = await User.findOne({email});

    if(user) {
      return res.json({success: false, message: "Account already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);
    const { publicKey, privateKey } = generateKeyPair();

    const newUser = await User.create({
      fullName, 
      email, 
      password: hashPassword, 
      bio, 
      publicKey,
      privateKey: null // Never store private key in DB
    });

    const token = generateToken(newUser._id);

    // Send private key as PEM string directly (don't convert to base64)
    res.json({
      success: true, 
      userData: newUser, 
      token, 
      privateKey: privateKey, // Send PEM directly
      message: "Account created successfully"
    });
  } catch(error) {
    console.log(error.message);
    res.json({success: false, message: error.message});
  }
}

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userData = await User.findOne({email});

    if (!userData) {
      return res.json({ success: false, message: "User not found, Please create a account" });
    }

    if (userData.isOAuthUser && !userData.password) {
      return res.status(400).json({
        success: false,
        message: "This email is registered via Google. Please login with Google."
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, userData.password);

    if(!isPasswordCorrect) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    const token = generateToken(userData._id);

    res.json({success: true, userData, token, message: "Login successfully"});
  } catch (error) {
    console.log(error.message);
    res.json({success: false, message: error.message});
  }
}

export const checkAuth = (req, res) => {
  res.json({success: true, user: req.user});
}

export const updateProfile = async (req, res) => {
  try {
    const { profilePic, bio, fullName } = req.body;
    const userId = req.user._id;
    let updatedUser;

    if(!profilePic) {
      updatedUser = await User.findByIdAndUpdate(userId, {bio, fullName}, {new: true});
    } else {
      const upload = await cloudinary.uploader.upload(profilePic);
      updatedUser = await User.findByIdAndUpdate(userId, {
        profilePic: upload.secure_url, 
        bio, 
        fullName
      }, {new: true});
    }
    res.json({success: true, user: updatedUser});
  } catch (error) {
    console.log(error.message);
    res.json({success: false, message: error.message});
  }
}