const {getUser} = require('../tempStorage');

const verifyUser = (req, res, next)=>{
    const sessionID = req.cookies.sessionID
    if(!getUser(sessionID)){
        res.status(400).json({"error": "invalid session id"})
        return;
    }
    if(getUser(sessionID).expires_in < Date.now()){
        res.status(400).json({"error": "session id expired"})
        return;
    }
    next();  

}
module.exports = verifyUser