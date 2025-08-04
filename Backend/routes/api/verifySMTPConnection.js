const router = require('express').Router()
const transporter = require('../../config/nodemailer')
router.get('/', async (req,res)=>{
    await transporter.verify();
    console.log("Server is ready to take our messages");
    res.send("connect to smtp server")
})
module.exports = router
