const {deleteTempUserData} = require('../tempStorage')
const logoutController = (req, res)=> {
    try{
    const sessionID = req.cookies.sessionID
    if(sessionID) deleteTempUserData(sessionID);
    
    res.status(200).json({"success" : "logged out successfull"})
    }
    catch(err){
        res.status(500).json({"error": "Internal Server Error"})
    }

}
module.exports = logoutController;