import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";

export const ChatContext = createContext();

export const ChatProvider = ({ children })=>{

const [messages, setMessages] = useState([]);
const [users, setUsers] = useState([]);
const [selectedUser, setSelectedUser] = useState(null);
const [selectedGrp, setSelectedGrp] = useState(null);
const [selectedProfile, setSelectedProfile] = useState(false);
const [selectedProfileGrp, setSelectedProfileGrp] = useState(false);
const [unseenMessages, setUnseenMessages] = useState({});
const [unseenGrpMessages, setUnseenGrpMessages] = useState({});
const {socket, axios, privateKey, authUser} = useContext(AuthContext);
const [groups, setGroups] = useState([]);
const [active, setActive] = useState("My Chat");
const [typingUsers, setTypingUsers] = useState({});
const [typingId, setTypingId] = useState("");
const [privateTypingUsers, setPrivateTypingUsers] = useState({});

// function to get all users for sidebar

const selectedUserRef = useRef(null);
const selectedGrpRef = useRef(null);

useEffect(() => {
  selectedUserRef.current = selectedUser;
}, [selectedUser]);
useEffect(() => {
  selectedGrpRef.current = selectedGrp;
}, [selectedGrp]);

const getUsers = async () =>{

try {
const { data } = await axios.get("/api/messages/users");

if (data.success) {
setUsers(data.users);
setUnseenMessages(data.unseenMessages);
}

} catch (error) {
    toast.error(error.message);
}
}

const fetchGroups = async () => {
      try {
        const { data } = await axios.get("/api/group/get-groups");
        if (data.success) {
          setGroups(data.groups);
        }
      } catch (error) {
        console.error("Error fetching groups:", error.message);
      }
    };


const getMessages = async (userId)=>{

try {
  console.log("user id is ", userId);
const { data } = await axios.post(`/api/messages/${userId}`, {
        privateKey: privateKey
      });

if (data.success){
setMessages(data.messages);
}

} catch (error) {
toast.error(error.message);
}
}


// function to send message to selected user

const sendMessage = async (messageData)=>{
try {
    if(!selectedUser) return;
     if (!selectedUser.publicKey) {
        toast.error("Unable to encrypt message: recipient's public key not found");
        return;
      }
    const payload = {
      ...messageData,
      receiverPublicKey: selectedUser.publicKey  // 🔹 add this
    };

    const {data} = await axios.post(`/api/messages/send/${selectedUser._id}`, payload);

    if(data.success){
    const displayMessage = {
          ...data.newMessage,
          text: messageData.text // Keep original text for immediate display
    };
    setMessages((prevMessages) => [...prevMessages, displayMessage]);
    } else {
    toast.error(data.message);
    }

} catch (error) {
   toast.error(error.message);
}
}






const sendGrpMsg = async ({ text, image, groupId }) => {
  try {
    const payload = { text, image, groupId };
    const { data } = await axios.post("/api/group/send-grpmsg", payload, { withCredentials: true });
    if (data) {
      setMessages((prev) => [...prev, data]); // <--- add message to local state
    }
    return data;
  } catch (err) {
    toast.error(err.message);
  }
};



const getGrpMessages = async (groupId) => {
  try {
    const { data } = await axios.get(`/api/group/get-grpmsg/${groupId}`, { withCredentials: true });
     if (data) {
      setMessages(data); // <--- update messages state
    }
    return data;
  } catch (err) {
    console.error("Error fetching group messages:", err);
    return [];
  }
};



// Register socket listeners ONCE when socket connects
useEffect(() => {
  if (!socket) {
    console.log("Server not available");
    return;
  }
   socket.onAny((event, ...args) => {
    
  });
  
  
  // ✅ Register ALL socket listeners here (only once)
  socket.on("newGroupMessage", (newMessage) => {
    
    if (selectedGrp && newMessage.groupId === selectedGrp._id) {
      setMessages((prev) => [...prev, newMessage]);
    } else {
      setUnseenMessages((prev) => ({
        ...prev,
        [newMessage.groupId]: prev[newMessage.groupId] ? prev[newMessage.groupId] + 1 : 1
      }));
    }
  });

  socket.on("userTyping", (data) => {
   
    
    const { senderId, senderName, groupId } = data;
    
    if (groupId) {
      setTypingUsers((prev) => {
        const updated = {
          ...prev,
          [groupId]: {
            ...(prev[groupId] || {}),
            [senderId]: senderName || "Someone"
          }
        };
        return updated;
      });
    } else {
      // Use callback form to get latest selectedUser
       setPrivateTypingUsers(prev => ({
      ...prev,
      [senderId]: senderName || "Someone"
    }));
    }
  });

  socket.on("userStopTyping", (data) => {
    const { senderId, groupId } = data;
    
    if (groupId) {
      setTypingUsers((prev) => {
        const copy = { ...prev };
        if (copy[groupId]) {
          const groupTyping = { ...copy[groupId] };
          delete groupTyping[senderId];
          
          if (Object.keys(groupTyping).length === 0) {
            delete copy[groupId];
          } else {
            copy[groupId] = groupTyping;
          }
        }
        return copy;
      });
    } else {
      setPrivateTypingUsers(prev => {
      const updated = { ...prev };
      delete updated[senderId];
      return updated;
    });
    }
  });

    socket.on("receiveGrpMsg", (msg) => {
      
      const currentGrp = selectedGrpRef.current;
    
    const senderId = msg.senderId?._id || msg.senderId;
    if (senderId === authUser._id) return;

   
    if (currentGrp && msg.groupId === currentGrp._id) {
     
      setMessages((prev) => [...prev, msg]);
    } else {
    setUnseenGrpMessages((prev) => ({
    ...prev,
    [msg.groupId]: {
      ...(prev[msg.groupId] || {}),
      [authUser._id]: (prev[msg.groupId]?.[authUser._id] || 0) + 1,
    },
  }));
    }
  });

  socket.on("newMessage", async (newMessage) => {
    const currentUser = selectedUserRef.current;
   
    
    
    if (currentUser && newMessage.senderId._id === currentUser._id) {
      let displayMessage = newMessage;
     
      
      if (newMessage.encryptedMessage && newMessage.encryptedKey && privateKey) {
        try {
          const { data } = await axios.post(`/api/messages/decrypt`, {
            messageId: newMessage._id,
            privateKey: privateKey
          });
         
          
          if (data.success) {
            displayMessage = { ...newMessage, text: data.decryptedText };
          }
         
        } catch (error) {
          displayMessage = { ...newMessage, text: '[Unable to decrypt message]' };
        }
      }
      
      displayMessage.seen = true;
      setMessages((prevMessages) => [...prevMessages, displayMessage]);
      axios.put(`/api/messages/mark/${newMessage._id}`);
    
    } else {
      
      const senderId = newMessage.senderId._id || newMessage.senderId;
     setUnseenMessages(prev => {
  const updated = {
    ...prev,
    [senderId]: prev[senderId] ? prev[senderId] + 1 : 1
  };
 
  return updated;
  });
 }
});

  // ✅ Cleanup: remove listeners when component unmounts
  return () => {
    socket.off("newMessage");
    socket.off("newGroupMessage");
    socket.off("userTyping");
    socket.off("userStopTyping");
    socket.off("receiveGrpMsg");
  };
}, [socket]); // ⚠️ Only depend on socket, not selectedUser/selectedGrp

// Remove the old subscribeToMessages and unsubscribeFromMessages functions


  const newGroupHandle = async({groupPic, groupData}) => {
      try{

        const payload = { ...groupData };
      if (groupPic) {
        payload.groupPic = groupPic;
      }

        const { data } = await axios.post("/api/group/new-group", payload);
        if(data.success){
           toast.success("Group created successfully");
           setTimeout(() => window.location.reload(), 1500);
           return ;
        }
        toast.error(data.message);
      } catch(error) {
         toast.error(error.message);
      }
  }

  const updateGrp = async() => {
     try {

     } catch (error) {
      
     }
  }

 

  const value = {
    messages, 
    users, 
    selectedUser, 
    getUsers, 
    getMessages, 
    sendMessage, 
    setSelectedUser, 
    unseenMessages, 
    setUnseenMessages, 
    unseenGrpMessages,
    setUnseenGrpMessages,
    selectedProfile, 
    setSelectedProfile,
    selectedProfileGrp,
    setSelectedProfileGrp,
    newGroupHandle,
    fetchGroups,
    groups,
    setGroups,
    selectedGrp,
    setSelectedGrp,
    sendGrpMsg,
    getGrpMessages,
    active,
    setActive,
    typingUsers,
    setTypingUsers,
    typingId,
    setTypingId,
    selectedUserRef,
    selectedGrpRef,
    setPrivateTypingUsers,
    privateTypingUsers,
    updateGrp,
  }

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  )
}