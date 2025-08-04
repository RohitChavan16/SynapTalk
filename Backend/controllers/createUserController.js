const { PrismaClient } = require("../generate/prisma");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();
const { v4: uuid } = require("uuid");
const { setUser } = require("../tempStorage");
const {sendOTP, sendEmailOTP, generateOTP, phoneOTPVerification} = require('../utils/otpFunctions')

const unverified_Data_Map = new Map();
const setUnVerifiedUser = (id, user)=> {
    unverified_Data_Map.set(id, user)
}
const getUniverifiedUser = (id)=> {
    return unverified_Data_Map.get(id)
}
const deleteUnverifiedUserData = (id) => {
    unverified_Data_Map.delete(id)
}
const createUser = async (req, res) => {
  const { name, phone, email, password } = req.body;
  if (name === null || phone === null || email === null || password === null) {
    res.status(401).json({ error: "credentials required" });
  }
  const existingUser = await prisma.user.findUnique({
    where: {
      phone: phone,
    },
  });
  if (existingUser) {
    res.status(403).json({ error: "user with same phone number exists" });
    return;
  }
  try {
    const hashedPwd = await bcrypt.hash(password, 10);
    const tempID = uuid();
    setUnVerifiedUser(
      tempID,
      {
        name,
        email,
        phone,
        hashedPwd,
        expires_in: Date.now() + 15 * 60 * 1000,
      }
    );
    sendOTP(phone);
   
    res.cookie("tempID", tempID, {
        httpOnly : false,
        secure: false,
        maxAge: 1 * 60 * 60 * 1000
    })
    res.status(200).json({ success: tempID });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const verifyPhone = async (req, res) => {
  const otp = req.body.otp;
  const tempID = req.cookies.tempID;
  if (!tempID) {
    res.status(401).json({
      status: "error" ,
      message : "Fill the form." 
    });
    return;
  }
  if(!otp){
    res.status(401).json({
      status : "error",
      message: "Credentials required"
    })
  }
  const unverified_user = getUniverifiedUser(tempID)
  if (!unverified_user) {
    res.status(401).send({ error: "First fill the form" });
  }
  if(unverified_user.expires_in < Date.now){
    deleteUnverifiedUserData(tempID)
    res.status(400).send({error : "otp Expired. Fill the form again"})
  }
  const verificationCheck = await phoneOTPVerification(otp, unverified_user.phone)
  console.log(verificationCheck.status);
  if(verificationCheck.status === 'approved'){
    const email_OTP = generateOTP()
    const info = await sendEmailOTP(unverified_user, email_OTP)
    console.log(info.messageId)
    unverified_Data_Map.set(tempID, {...unverified_user, phone_verified: true, email_OTP: email_OTP})
    res.status(200).json({
      status : "success",
      message: "phone number verified move to email verification"
    })
  }
};

const verifyEmail = async (req, res) => {
  const otp = req.body.otp;
  const tempID = req.cookies.tempID;
  let unverified_user = unverified_Data_Map.get(tempID);
  if(!unverified_user || unverified_user.expires_in < Date.now || !unverified_user.phone_verified
    || !unverified_user.email_OTP
  ){
    res.status(400).json({
      status : "error",
      message: "phone number unverified"
    })
  }
  else if(unverified_user.email_OTP != otp){
    res.status(401).json({
      status: "failure",
      message : "wrong otp"
    })
  }
  else{
    try {
      await prisma.user.create({
        data: getUniverifiedUser(tempID),
      });
      const sessionID = uuid()
      delete unverified_user.password
      delete unverified_user.email_OTP
      delete unverified_user.verified_phone
      setUser(sessionID, unverified_user)
      deleteUnverifiedUserData(tempID)
      res.cookie('sessionID', sessionID)
      res.cookie('tempID', '')
      res.status(200).json({ success: "user created successfully" });
  } catch (err) {
    res.cookie('tempID', '')
    deleteUnverifiedUserData(tempID)
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
  }
  console.log("Message sent:", info.messageId);
}

module.exports = { createUser, verifyPhone, verifyEmail };







