const { PrismaClient } = require('../generate/prisma')
const bcrypt =  require('bcrypt')
const prisma = new PrismaClient()

const createAccount = async (req, res)=>{
    const {type, initial_deposit} = req.body
    if(type === null || initial_deposit == null){
        res.status(401).json({"error" : "credentials required"})
    }
    const user = await prisma.user.findUnique({
        where: {
            phone: phone
        }
    })
    if(!existingUser){
        res.status(403).json({"error": "user with same phone number exists"})
        return
    }
    try{
    const hashedPwd = await bcrypt.hash(password, 10)
    await prisma.User.create({
        data:{
            name: name,
            phone: phone,
            email: email,
            password: hashedPwd
        }

})
    res.status(200).json({"success": "user created successfully"})
    }
    catch(err){
        console.log(err)
        res.status(500).json({"error": "Internal Server Error"})
    }
}
module.exports = createUser