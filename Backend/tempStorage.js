const sessionID_to_user_map =new Map()

const setUser = (user, id)=>{
    sessionID_to_user_map.set(id, user) 
}
const getUser = (id) =>{
    return sessionID_to_user_map.get(id)
}
const deleteTempUserData = (id) =>{
    sessionID_to_user_map.delete(id)
}
const removePassword = (id)=> {
    let newData =sessionID_to_user_map.get(id)
    delete newData.password
    sessionID_to_user_map.set(id, newData)
}
module.exports = {setUser, getUser, deleteTempUserData, removePassword}