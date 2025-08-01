const { PrismaClient } = require("../generate/prisma");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();
const twilio = require("twilio");
const { v4: uuid } = require("uuid");
const client = twilio(process.env.ACCOUNTS_ID, process.env.AUTH_TOKEN);
const { setUser } = require("../tempStorage");

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
        hashedPwd,
        expires_in: Date.now() + 15 * 60 * 1000,
      }
    );
    sendOtp(phone);
   
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
  if (!otp || !tempID) {
    res.status(401).json({ error: "credentials required" });
    return;
  }
  if (!getUniverifiedUser(tempID)) {
    res.status(401).send({ error: "otp Expired" });
  }
  if(getUniverifiedUser(tempID).expires_in < Date.now){
    deleteUnverifiedUserData(tempID)
    res.status(400).send({error : "otp Expired"})
  }
  const verificationCheck = await client.verify.v2
    .services(process.env.SERVICE)
    .verificationChecks.create({
      code: `${otp}`,
      to: `+91${getUniverifiedUser(tempID).phone}`,
    });
  console.log(verificationCheck.status);
  try {
    if (verificationCheck.status === "approved") {
      await prisma.user.create({
        data: getUniverifiedUser(tempID),
      });
      const sessionID = uuid()
      let verified_user_data = getUniverifiedUser(tempID)
      delete verified_user_data.password
      setUser(sessionID, verified_user_data)
      deleteUnverifiedUserData(tempID)
      res.cookie('sessionID', sessionID)
      res.cookie('tempID', '')
      res.status(200).json({ success: "user created successfully" });
    } else {
      res.status(400).json({ failure: "incorrect OTP" });
    }
  } catch (err) {
    res.cookie('tempID', '')
    deleteUnverifiedUserData(tempID)
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};



const sendOtp = (phone) => {
  client.verify.v2
    .services("VA1cc220171c25de3e81684bbda9e6c610")
    .verifications.create({ to: `+91${phone}`, channel: "sms" })
    .then((verification) => console.log(verification.sid));
};
module.exports = { createUser, verifyPhone };
