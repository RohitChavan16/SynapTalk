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
const {socket, axios, privateKey, authUser, token} = useContext(AuthContext);
const [groups, setGroups] = useState([]);
const [active, setActive] = useState("My Chat");
const [typingUsers, setTypingUsers] = useState({});
const [typingId, setTypingId] = useState("");
const [privateTypingUsers, setPrivateTypingUsers] = useState({});
const [latestMessages, setLatestMessages] = useState({});
const [latestGrpMessages, setLatestGrpMessages] = useState({});
const [totalUserCount, setTotalUserCount] = useState(0);
const [totalGrpCount, setTotalGrpCount] = useState(0);


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
    setLatestMessages(prev => ({
        ...prev,
        [selectedUser._id]: {
          text: messageData.text || (messageData.image ? "📷 Photo" : ""),
          createdAt: new Date().toISOString(),
          seen: false,
          isSender: true
        }
      }));
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
      setLatestGrpMessages(prev => ({
        ...prev,
        [groupId]: {
          text: text || (image ? "📷 Photo" : ""),
          createdAt: new Date().toISOString(),
          isSender: true,
          senderName: authUser.fullName
        }
      }));
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
    setLatestGrpMessages((prev) => ({
    ...prev,
    [msg.groupId]: {
      text: msg.text || (msg.image ? "📷 Photo" : ""),
      createdAt: msg.createdAt,
      isSender: false,
      senderName: msg.senderId?.fullName || msg.sender?.fullName || "Someone"
    }
  }));
  });

  socket.on("newMessage", async (newMessage) => {
    const currentUser = selectedUserRef.current;
   
    let displayMessage = newMessage;
    
    
    if (currentUser && newMessage.senderId._id === currentUser._id) {
      
     
      
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


const senderId = newMessage.senderId._id || newMessage.senderId;
  const receiverId = newMessage.receiverId._id || newMessage.receiverId;
  
  // Determine the "other user" ID based on current user
  const otherUserId = senderId === authUser._id ? receiverId : senderId;
  
  setLatestMessages((prev) => ({
    ...prev,
    [otherUserId]: {
      text: displayMessage.text || (displayMessage.image ? "📷 Photo" : ""),
      createdAt: displayMessage.createdAt,
      seen: displayMessage.seen || false,
      isSender: senderId === authUser._id
    }
  }));


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

  const updateGrp = async({ grpId, grpName, description, grpImage1 }) => {
     try {

      if (!grpId){
        toast.error("Group not selected, please reload the page");
      }

      const trimmedName = grpName.trim();
      if (!trimmedName) return toast.error("Name cannot be empty");

      const payload = {};

      if (trimmedName) payload.name = trimmedName;
      if (description != null) payload.description = description;
      if (grpImage1) payload.groupPic = grpImage1; 
      
      const { data } = await axios.put(`/api/group/updateGrp/${grpId}`, payload);
      if(data.success){
           toast.success("Group updated successfully");
           setSelectedGrp(data.group);
           
           return ;
        }
        
      toast.error(data.message);
      
     } catch (error) {
       toast.error(error.message);
     }
  }


  const addExtraMem = async({mem}) => {
     try{
      const grpId = selectedGrp._id;
      const grpInfo = {}
      if (!mem || !Array.isArray(mem) || mem.length === 0) {
      toast.error("No members to add");
      return;
      }
      if (!selectedGrp?._id) {
      toast.error("No group selected");
      return;
      }
      grpInfo.grpId = grpId;
      grpInfo.members = mem; 
      const { data } = await axios.put("/api/group/add-extra-mem", grpInfo);
      if(data.success){
        toast.success("Member added successfully");
        return true;
      }
      toast.error(data.message);
      return false;
     } catch (error) {
      toast.error(error.message || "Failed to add member");
      return false
     }
  }



  const deleteMember = async (memberId) => {
     try {
      const groupId = selectedGrp._id;
       const { data } = await axios.delete(`/api/group/delete-mem/${memberId}`, { data: { groupId } });
       if(data.success){
        toast.success("Member deleted successfully");
        return true;
       }
       toast.error(data.message);
       return false;
     } catch (error) {
      toast.error(error.message || "Failed to delete member");
      return false
     }
  }



const fetchLatestMessages = async () => {
  try {
    
    const res = await axios.get("/api/messages/latest-msg");
    
    if (res.data.success && Array.isArray(res.data.messages)) {
      const latest = {};

      for (const msg of res.data.messages) {
        let text = msg.text;
       
        // Decrypt if needed
        if (msg.encryptedMessage && msg.encryptedKey && privateKey) {
          try {
           
            const { data } = await axios.post(`/api/messages/decrypt`, {
              messageId: msg._id,
              privateKey: privateKey
            }, {
              headers: {
              Authorization: `Bearer ${token}` 
             }
            });
            if (data.success) text = data.decryptedText;
          } catch(err) {
            
            text = "[Unable to decrypt message]";
          }
        }

        // Handle image messages
        if (!text && msg.image) {
          text = "📷 Photo";
        }

        const otherUserId = msg.isSender ? 
          (msg.receiver._id || msg.receiver) : 
          (msg.sender._id || msg.sender);

        latest[otherUserId] = {
          text,
          createdAt: msg.createdAt,
          seen: msg.seen || false,
          isSender: msg.isSender // Track if current user sent this
        };
      }

      setLatestMessages(latest);
      return latest;
    }
    return {};
  } catch (err) {
    console.error("Error fetching latest messages:", err);
    return {};
  }
};





const fetchLatestGrpMessages = async () => {
  try {
    const res = await axios.get("/api/group/latest-grpmsg");
    
    if (res.data.success && Array.isArray(res.data.messages)) {
      const latest = {};

      for (const msg of res.data.messages) {
        console.log("Group message:", msg);
        latest[msg.groupId] = {
          text: msg.text || (msg.image ? "📷 Photo" : ""),
          createdAt: msg.createdAt,
          isSender: msg.isSender,
          senderName: msg.sender?.fullName || "Unknown"
        };
      }

      setLatestGrpMessages(latest);
      return latest;
    }
    return {};
  } catch (err) {
    console.error("Error fetching latest group messages:", err);
    return {};
  }
};




 

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
    addExtraMem,
    deleteMember,
    setLatestMessages,
    latestMessages,
    fetchLatestMessages,
    latestGrpMessages,
    setLatestGrpMessages,
    fetchLatestGrpMessages,
    totalUserCount,
    setTotalUserCount,
    totalGrpCount,
    setTotalGrpCount,
  }

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  )
}