import User from "../models/User.js";
import bcrypt from "bcryptjs"; 
import { generateToken } from "../utils/jwtToken.js";
import cloudinary from "../lib/cloudinary.js";
import transporter from "../config/nodemailer.js";
import { getWelcomeEmailHTML } from "../emailTemplates/welcomeEmail.js";
import AppError from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";

export const signup = catchAsync(async (req, res, next) => {
  const { fullName, email, password, bio } = req.body;

  if (!fullName || !email || !password || !bio) {
    return next(new AppError("Missing Details", 400));
  }

  const user = await User.findOne({email});

  if(user) {
    return next(new AppError("Account already exists", 400));
  }

  const salt = await bcrypt.genSalt(10);
  const hashPassword = await bcrypt.hash(password, salt);

  const newUser = await User.create({
    fullName, 
    email, 
    password: hashPassword, 
    bio, 
    privateKey: null
  });

  const token = generateToken(newUser._id);

  const mailOptions = {
    from: process.env.SENDER_EMAIL,
    to: email,
    subject: "Welcome to SynapTalk",
    text: `Thankyou for using the SynapTalk. Your account has been created successfully with email id: ${email}`,
    html: getWelcomeEmailHTML(email, fullName),
  };

  transporter.sendMail(mailOptions).catch(err => {
    console.error("Email sending failed:", err);
  });

  res.json({
    success: true, 
    userData: newUser, 
    token, 
    message: "Account created successfully"
  });
});

export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  
  if(!email || !password){
      return next(new AppError("Fill all required data", 400));
  }
  
  const userData = await User.findOne({email});

  if (!userData) {
    return next(new AppError("User not found, Please create a account", 404));
  }

  if (userData.isOAuthUser && !userData.password) {
    return next(new AppError("This email is registered via Google. Please login with Google.", 400));
  }

  const isPasswordCorrect = await bcrypt.compare(password, userData.password);

  if(!isPasswordCorrect) {
    return next(new AppError("Invalid credentials", 401));
  }

  const token = generateToken(userData._id);

  res.json({success: true, userData, token, message: "Login successfully"});
});

export const checkAuth = catchAsync(async (req, res, next) => {
  res.json({success: true, user: req.user});
});

export const updateProfile = catchAsync(async (req, res, next) => {
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
});

export const getSocialLink = catchAsync(async(req, res, next) => {
  const userId = req.user._id;
  const user = await User.findById(userId);
  if(!user) return next(new AppError("User not Found", 404));
  const socialLink = user.socialLinks;

  res.json({success: true, socialLink});
});

export const addSocialLink = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { platform, url, isVisible, priority } = req.body;

  const user = await User.findById(userId);
  if (!user) return next(new AppError("User not found", 404));

  const exists = user.socialLinks.find(
    (link) => link.platform === platform
  );
  if (exists)
    return next(new AppError("Platform already exists", 400));

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
}); 

export const editSocialLink = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { platform, url, isVisible, priority, msgCount } = req.body;

  const user = await User.findById(userId);
  if (!user) return next(new AppError("User not found", 404));

  const link = user.socialLinks.find(
    (l) => l.platform.toLowerCase() === platform.toLowerCase()
  );

  if (!link)
    return next(new AppError("Social link not found", 404));

  if (url) link.url = url;
  if (isVisible !== undefined) link.isVisible = isVisible;
  if (priority !== undefined) link.priority = priority;
  if (msgCount !== undefined) link.msgCount = msgCount;

  link.lastUpdated = Date.now();

  await user.save({ validateBeforeSave: false });
  res.json({success: true, socialLink: user.socialLinks, message: "Social link updated" });
});

export const deleteSocialLink = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { platform } = req.body;

  const user = await User.findById(userId);
  if (!user) return next(new AppError("User not found", 404));

  const initialCount = user.socialLinks.length;
  user.socialLinks = user.socialLinks.filter(
    (l) => l.platform.toLowerCase() !== platform.toLowerCase()
  );

  if (user.socialLinks.length === initialCount)
    return next(new AppError("Platform not found", 404));

  await user.save({ validateBeforeSave: false });
  res.json({success: true, socialLink: user.socialLinks, message: "Social link deleted" });
});

// --- E2EE Key Management ---

export const exportLegacyKey = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) return next(new AppError("User not found", 404));
  
  // Return the legacy private key for migration, if it still exists
  res.json({
    success: true,
    privateKey: user.privateKey || null
  });
});

export const uploadPublicKey = catchAsync(async (req, res, next) => {
  const { publicKey } = req.body;
  if (!publicKey) return next(new AppError("Public key required", 400));
  
  await User.findByIdAndUpdate(req.user._id, { 
    publicKey: publicKey 
  });
  
  res.json({ success: true, message: "Public key updated" });
});

export const updateBackupStatus = catchAsync(async (req, res, next) => {
  const { hasBackedUpKeys } = req.body;
  
  await User.findByIdAndUpdate(req.user._id, { 
    hasBackedUpKeys: hasBackedUpKeys 
  });
  
  res.json({ success: true, message: "Backup status updated" });
});