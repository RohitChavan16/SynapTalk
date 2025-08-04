const crypto = require('crypto')
const twilio = require("twilio");
const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
const transporter = require('../config/nodemailer')

const sendOTP = (phone) => {
  client.verify.v2
    .services(process.env.SERVICE)
    .verifications.create({ to: `+91${phone}`, channel: "sms" })
    .then((verification) => console.log(verification.sid));
};
function generateOTP() {
    let numbers = [1, 2, 3, 4,5,6,7,8,9,0]
  let otp = '';
  for (let i = 0; i < 6; i++) {
    otp += numbers[crypto.randomInt(numbers.length)];
  }
  return otp;
}
async function phoneOTPVerification(otp, phone) {
    return await client.verify.v2
        .services(process.env.SERVICE)
        .verificationChecks.create({
        code: `${otp}`,
        to: `+91${phone}`,
        });
}
async function sendEmailOTP(unverified_user, otp) {
    console.log("email sent to : " + unverified_user.email)
  
    return await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: unverified_user.email,
    subject: "Email Verification",
    text: `Dear ${unverified_user.name},

To verify your email address please use the One-Time Password (OTP) provided below:

🔑 **Your OTP is: ${otp}**

This OTP is valid for the next 10 minutes. Please do not share this code with anyone, including bank staff.

If you did not request this verification, please contact us immediately at [Bank Support Contact].

Thank you for banking with us.

Sincerely,  
Bank of Maharashtra  
Customer Service Team  
[Bank Website URL]

Note: This is an automatically generated email. Please do not reply to this message.
`// plain‑text body
    // html: "<b>Hello world?</b>", // HTML body
  });
}
module.exports = {sendOTP, sendEmailOTP, generateOTP, phoneOTPVerification}