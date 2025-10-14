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
const {socket, axios, privateKey, authUser} = useContext(AuthContext);
const [groups, setGroups] = useState([]);
const [active, setActive] = useState("My Chat");
const [typingUsers, setTypingUsers] = useState({});
const [typingId, setTypingId] = useState("");

// function to get all users for sidebar

const selectedUserRef = useRef(selectedUser);

useEffect(() => {
  selectedUserRef.current = selectedUser;
}, [selectedUser]);

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



const subscribeToMessages = async () => {
    if(!socket) return;

    socket.on("newGroupMessage", (newMessage) => {
  if (selectedGrp && newMessage.groupId === selectedGrp._id) {
    setMessages((prev) => [...prev, newMessage]);
  } else {
    // 🔹 Optionally: add unseen group counter
    setUnseenMessages((prev) => ({
      ...prev,
      [newMessage.groupId]: prev[newMessage.groupId] 
        ? prev[newMessage.groupId] + 1 
        : 1
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
    if (senderId !== selectedUserRef.current?._id) return; // only update if current chat
    setTypingUsers((prev) => ({ ...prev, [senderId]: true }));
  }
  console.log("💡 userTyping received:", data, "selectedUser:", selectedUserRef.current);

  console.log("=== END userTyping PROCESSING ===\n");
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
   
    
    setTypingUsers((prev) => {
      const copy = { ...prev };
      delete copy[senderId];
     
      return copy;
    });
  }
});


    socket.on("newMessage", async (newMessage) => {
      if(selectedUser && newMessage.senderId === selectedUser._id) {
        // Try to decrypt the message if it's encrypted
        let displayMessage = newMessage;
        
        if (newMessage.encryptedMessage && newMessage.encryptedKey && privateKey) {
          try {
            // Client-side decryption would require crypto libraries
            // For now, we'll request decryption from backend
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
        setUnseenMessages((prevUnseenMessages) => ({
          ...prevUnseenMessages, 
          [newMessage.senderId]: prevUnseenMessages[newMessage.senderId] 
            ? prevUnseenMessages[newMessage.senderId] + 1 
            : 1
        }));
      }
    });
  }

  const unsubscribeFromMessages = () => {
    if (socket) {
  socket.off("newMessage");
  socket.off("newGroupMessage"); // <--- new
  socket.off("userTyping");
  socket.off("userStopTyping");
}
  }


  const newGroupHandle = async({groupPic, groupData}) => {
      try{

        const payload = { ...groupData };
      if (groupPic) {
        payload.groupPic = groupPic;
      }

        const { data } = await axios.post("/api/group/new-group", payload);
        if(data.success){
           toast.success("Group created successfully");
           return ;
        }
        toast.error(data.message);
      } catch(error) {
         toast.error(error.message);
      }
  }

  useEffect(() => {
  if (socket) {
    console.log("✅ Socket connected, id:", socket.id);
  } else {
    console.log("❌ Socket not connected yet");
  }
}, [socket]);


  useEffect(() => {
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [socket, selectedUser, privateKey, selectedGrp])

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
    setTypingId
  }

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  )
}