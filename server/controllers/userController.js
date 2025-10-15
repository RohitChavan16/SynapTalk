import User from "../models/User.js";
import bcrypt from "bcryptjs"; 
import { generateToken } from "../utils/jwtToken.js";
import cloudinary from "../lib/cloudinary.js";
import { generateKeyPair } from "../crypto/crypto.js";
import transporter from "../config/nodemailer.js";
import { getWelcomeEmailHTML } from "../emailTemplates/welcomeEmail.js";









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

    const mailOptions = {
    from: process.env.SENDER_EMAIL,
    to: email,
    subject: "Welcome to SynapTalk",
    text: `Thankyou for using the SynapTalk. Your account has been created successfully with email id: ${email}`,
    html: getWelcomeEmailHTML(email, fullName),
   }

    transporter.sendMail(mailOptions).catch(err => {
      console.error("Email sending failed:", err);
      // Log but don't fail the signup
    });

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
    
    if(!email || !password){
        return res.json({success: false, message: "Fill all required data"});
    }
    
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


export const getSocialLink = async(req, res) => {
    
 try{
  const userId = req.user._id;
  const user = await User.findById(userId);
  if(!user) return res.json({success: false, message: "User not Found"});
  const socialLink = user.socialLinks;

  res.json({success: true, socialLink});
 } catch (error) {
   console.log(error.message);
  res.json({success: false, message: error.message});
 }

}











export const addSocialLink = async (req, res) => {
   try {
     const userId = req.user._id;
      const { platform, url, isVisible, priority } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // check if platform already exists
    const exists = user.socialLinks.find(
      (link) => link.platform === platform
    );
    if (exists)
      return res.status(400).json({ message: "Platform already exists" });

    const newLink = {
      platform,
      url,
      isVisible,
      priority,
      msgCount: 0,
      lastUpdated: Date.now(),
    };

    user.socialLinks.push(newLink);
    await user.save({ validateBeforeSave: false });

    res.status(201).json({
      success: true,
      socialLink: user.socialLinks,
      message: "Social link added successfully"
    });
   } catch (error) {
      console.log(error.message);
      res.json({success: false, message: error.message});
   }
} 










export const editSocialLink = async (req, res) => {
   try {
     const userId = req.user._id;
     const { platform, url, isVisible, priority, msgCount } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const link = user.socialLinks.find(
      (l) => l.platform.toLowerCase() === platform.toLowerCase()
    );

    if (!link)
      return res.status(404).json({ message: "Social link not found" });

    if (url) link.url = url;
    if (isVisible !== undefined) link.isVisible = isVisible;
    if (priority !== undefined) link.priority = priority;
    if (msgCount !== undefined) link.msgCount = msgCount;

    link.lastUpdated = Date.now();

    await user.save({ validateBeforeSave: false });
    res.json({success: true, socialLink: user.socialLinks, message: "Social link updated" });
   } catch (error) {
      console.log(error.message);
      res.json({success: false, message: error.message});
   }
}










export const deleteSocialLink = async (req, res) => {
   try {
     const userId = req.user._id;
     const { platform } = req.body; // or req.params.platform

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const initialCount = user.socialLinks.length;
    user.socialLinks = user.socialLinks.filter(
      (l) => l.platform.toLowerCase() !== platform.toLowerCase()
    );

    if (user.socialLinks.length === initialCount)
      return res.status(404).json({ message: "Platform not found" });

    await user.save({ validateBeforeSave: false });
    res.json({success: true, socialLink: user.socialLinks, message: "Social link deleted" });
   } catch (error) {
      console.log(error.message);
      res.json({success: false, message: error.message});
   }
}