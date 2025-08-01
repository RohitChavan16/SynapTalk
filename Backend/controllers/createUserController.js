const { PrismaClient } = require('../generate/prisma')
const bcrypt =  require('bcrypt')
const prisma = new PrismaClient()
const twilio = require('twilio')
const crypto = require('crypto');

const client = twilio(process.env.ACCOUNTS_ID, process.env.AUTH_TOKEN)
const dataStore = []

const createUser = async (req, res)=>{
    const {name, phone, email, password} = req.body
    if(name === null || phone === null || email === null || password === null){
        res.status(401).json({"error" : "credentials required"})
    }
    const existingUser = await prisma.user.findUnique({
        where: {
            phone: phone
        }
    })
    if(existingUser){
        res.status(403).json({"error": "user with same phone number exists"})
        return
    }
    try{
    dataStore[phone] = {name, email,password, expiresin: Date.now() + 5 * 60 * 1000}
    sendOtp(phone)
    res.status(200).json({"success": "move to step-2: verification"})
    }
    catch(err){
        console.log(err)
        res.status(500).json({"error": "Internal Server Error"})
    }
}

const verifyPhone = async (req, res)=>{
    const phone = req.body.phone;
    const otp = req.body.otp;
     if(!otp){
        res.status(401).json({"error" : "otp required"})
        return;
    }
    if(!dataStore[phone]){
        res.status(401).send({"error": "otp Expired"})
    }
    const verificationCheck = await client.verify.v2
    .services("VA1cc220171c25de3e81684bbda9e6c610")
    .verificationChecks.create({
      code: `${otp}`,
      to: `+91${phone}`,
    });
    console.log(verificationCheck.status);
try{
    if(verificationCheck.status === 'approved'){
         const hashedPwd = await bcrypt.hash(dataStore[phone].password, 10)
        await prisma.user.create({
            data:{
                name: dataStore[phone].name,
                phone: phone,
                email: dataStore[phone].email,
                password: hashedPwd
            }

        })
        delete otp[phone]
        console.log(otp)
        res.status(200).json({"success": "user created successfully"})
    }
    else{
        res.status(400).json({"failure": "incorrect OTP"})
    }
}
catch(err){
    console.log(err);
    res.status(500).json({"error" : "Internal Server Error"})
}d

}
const sendOtp = (phone)=>{
client.verify.v2.services("VA1cc220171c25de3e81684bbda9e6c610")
      .verifications
      .create({to: `+91${phone}`, channel: 'sms'})
      .then(verification => console.log(verification.sid));
}
module.exports = createUser;