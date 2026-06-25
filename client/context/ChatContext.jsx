import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "./AuthContext";
import { CryptoContext } from "./CryptoContext";
import toast from "react-hot-toast";
import axiosInstance from "../src/lib/axiosInstance.js";

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
const {socket, axios, authUser, token} = useContext(AuthContext); // Removed privateKey
const { encryptMessage, decryptMessage, isCryptoReady } = useContext(CryptoContext);
const [groups, setGroups] = useState([]);
const [active, setActive] = useState("My Chat");
const [typingUsers, setTypingUsers] = useState({});
const [typingId, setTypingId] = useState("");
const [privateTypingUsers, setPrivateTypingUsers] = useState({});
const [latestMessages, setLatestMessages] = useState({});
const [latestGrpMessages, setLatestGrpMessages] = useState({});
const [totalUserCount, setTotalUserCount] = useState(0);
const [totalGrpCount, setTotalGrpCount] = useState(0);
const [hasMoreMessages, setHasMoreMessages] = useState(true);
const [nextCursor, setNextCursor] = useState(null);
const [isUsersLoading, setIsUsersLoading] = useState(true);
const [isGroupsLoading, setIsGroupsLoading] = useState(true);


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
setIsUsersLoading(true);
try {
const { data } = await axios.get("/api/messages/users");

if (data.success) {
setUsers(data.users);
setUnseenMessages(data.unseenMessages);
}

} catch (error) {
    toast.error(error.response?.data?.message || error.message);
} finally {
    setIsUsersLoading(false);
}
}

const fetchGroups = async () => {
      setIsGroupsLoading(true);
      try {
        const { data } = await axios.get("/api/group/get-groups");
        if (data.success) {
          for (const grp of data.groups) {
             await verifyAndPinGroupState(grp);
          }
          setGroups(data.groups);
        }
      } catch (error) {
        console.error("Error fetching groups:", error.response?.data?.message || error.message);
      } finally {
        setIsGroupsLoading(false);
      }
    };


const getMessages = async (userId, cursor = null) => {
  try {
    let url = `/api/messages/${userId}`;
    if (cursor) {
      url += `?cursor=${cursor}`;
    } else {
      setHasMoreMessages(true);
      setNextCursor(null);
    }

    const { data } = await axios.post(url);

    if (data.success) {
      // Local Decryption Phase
      const decryptedMessages = await Promise.all(
        data.messages.map(async (msg) => {
          const isSender = msg.senderId === authUser._id || msg.senderId?._id === authUser._id;
          const decryptedText = await decryptMessage(msg, isSender);
          return { ...msg, text: decryptedText };
        })
      );

      if (cursor) {
        setMessages((prev) => [...decryptedMessages, ...prev]);
      } else {
        setMessages(decryptedMessages);
      }
      setNextCursor(data.nextCursor);
      setHasMoreMessages(!!data.nextCursor);
    }
  } catch (error) {
    toast.error(error.response?.data?.message || error.message);
  }
};

const sendMessage = async (messageData) => {
  try {
    if (!selectedUser) return;
    if (!selectedUser.publicKey) {
      toast.error("Unable to encrypt message: recipient's public key not found");
      return;
    }

    let payload = { ...messageData };

    // Local Encryption Phase
    if (messageData.text) {
      const encryptedPayload = await encryptMessage(
        messageData.text,
        selectedUser.publicKey,
        selectedUser._id
      );
      payload = { ...payload, ...encryptedPayload };
      delete payload.text;
    }

    const { data } = await axios.post(`/api/messages/send/${selectedUser._id}`, payload);

    if (data.success) {
      const displayMessage = {
        ...data.newMessage,
        text: messageData.text // Keep original text for immediate UI display
      };
      
      if (seenMessageIds.current.has(String(displayMessage._id))) {
        displayMessage.seen = true;
      }
      
      setMessages((prevMessages) => [...prevMessages, displayMessage]);
      setLatestMessages((prev) => ({
        ...prev,
        [selectedUser._id]: {
          text: messageData.text || (messageData.image ? "📷 Photo" : ""),
          createdAt: new Date().toISOString(),
          seen: false,
          isSender: true,
        },
      }));
    } else {
      toast.error(data.message);
    }
  } catch (error) {
    toast.error(error.message);
  }
};






const sendGrpMsg = async ({ text, image, groupId }) => {
  try {
    const currentGrp = selectedGrpRef.current || groups.find(g => g._id === groupId);
    if (!currentGrp) {
      toast.error("Group context missing");
      return;
    }

    let payload = { groupId };
    
    // Encrypt the group message
    if (text) {
      try {
        const { encryptedPayload, distributions } = await encryptGroupMessage(text, currentGrp);
        payload = { ...payload, ...encryptedPayload };

        // Send 1:1 distributions
        if (distributions && distributions.length > 0) {
           for (const dist of distributions) {
             axios.post(`/api/messages/send/${dist.receiverId}`, dist.payload).catch(console.error);
           }
        }
      } catch (err) {
         toast.error(`Encryption failed: ${err.message}`);
         return;
      }
    }
    if (image) payload.image = image;

    const { data } = await axios.post("/api/group/send-grpmsg", payload, { withCredentials: true });
    if (data) {
      const displayMessage = {
        ...data,
        text: text // Keep original text for immediate UI display
      };
      setMessages((prev) => [...prev, displayMessage]); 
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
    toast.error(err.response?.data?.message || err.message);
  }
};



const getGrpMessages = async (groupId, cursor = null) => {
  try {
    let url = `/api/group/get-grpmsg/${groupId}`;
    if (cursor) {
      url += `?cursor=${cursor}`;
    } else {
      setHasMoreMessages(true);
      setNextCursor(null);
    }
    const { data } = await axios.get(url, { withCredentials: true });
     if (data.success) {
       // Decrypt group messages
       const decryptedMessages = await Promise.all(
         data.messages.map(async (msg) => {
           const senderId = msg.senderId?._id || msg.senderId;
           if (msg.ciphertext) {
             const decryptedText = await decryptGroupMessage(msg, senderId, msg.senderId?.publicKey);
             return { ...msg, text: decryptedText };
           }
           return msg;
         })
       );

       if (cursor) {
         setMessages(prev => [...decryptedMessages, ...prev]);
       } else {
         setMessages(decryptedMessages);
       }
       setNextCursor(data.nextCursor);
       setHasMoreMessages(!!data.nextCursor);
    }
    return data;
  } catch (err) {
    console.error("Error fetching group messages:", err.response?.data?.message || err.message);
    return [];
  }
};


// Add this function in your ChatContext provider
// Update the sendAIMessage function in ChatContext.jsx

const sendAIMessage = async ({ text, receiverId, groupId }) => {
  try {
    const res = await axios.post("/api/ai/message", {
      text,
      receiverId,
      groupId,
    });

    // ✅ Immediately add AI response to local messages
    if (res.data) {
      const aiMessage = res.data;
      
      // Add to messages state immediately for sender
      setMessages((prev) => [...prev, aiMessage]);
      
      // Update latest messages
      if (receiverId) {
        setLatestMessages(prev => ({
          ...prev,
          [receiverId]: {
            text: aiMessage.text || "🤖 AI Response",
            createdAt: new Date().toISOString(),
            seen: false,
            isSender: true
          }
        }));
      } else if (groupId) {
        setLatestGrpMessages(prev => ({
          ...prev,
          [groupId]: {
            text: aiMessage.text || "🤖 AI Response",
            createdAt: new Date().toISOString(),
            isSender: true,
            senderName: authUser.fullName
          }
        }));
      }
    }

    return res.data;
  } catch (error) {
    console.error("Error sending AI message:", error);
    toast.error(error.response?.data?.error || "Failed to get AI response");
  }
};

  const seenMessageIds = useRef(new Set());

// Register socket listeners ONCE when socket connects
useEffect(() => {
  if (!socket) {
    console.log("Server not available");
    return;
  }
   socket.onAny((event, ...args) => {
    
  });
  socket.on("messagesSeen", ({ byUserId }) => {
    setMessages((prev) => 
      prev.map((msg) => {
        const senderIdStr = String(typeof msg.senderId === 'object' ? (msg.senderId?._id || msg.senderId) : msg.senderId);
        const receiverIdStr = String(typeof msg.receiverId === 'object' ? (msg.receiverId?._id || msg.receiverId) : msg.receiverId);
        
        if (senderIdStr === String(authUser._id) && receiverIdStr === String(byUserId) && !msg.seen) {
          return { ...msg, seen: true };
        }
        return msg;
      })
    );
    
    setLatestMessages((prev) => {
      if (prev[byUserId] && prev[byUserId].isSender && !prev[byUserId].seen) {
        return {
          ...prev,
          [byUserId]: { ...prev[byUserId], seen: true }
        };
      }
      return prev;
    });
  });

  socket.on("messageSeen", ({ byUserId, messageId }) => {
    console.log("🔥 RECEIVED messageSeen via SOCKET for msg:", messageId, "byUser:", byUserId);
    seenMessageIds.current.add(String(messageId));
    
    setMessages((prev) => 
      prev.map((msg) => {
        if (String(msg._id) === String(messageId)) {
          console.log("✅ MATCHED msg locally, updating seen: true");
          return { ...msg, seen: true };
        }
        return msg;
      })
    );
    
    setLatestMessages((prev) => {
      if (prev[byUserId] && prev[byUserId].isSender && !prev[byUserId].seen) {
        return {
          ...prev,
          [byUserId]: { ...prev[byUserId], seen: true }
        };
      }
      return prev;
    });
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

  socket.on("receiveGrpMsg", async (msg) => {
      const currentGrp = selectedGrpRef.current;
      const senderId = msg.senderId?._id || msg.senderId;
      if (senderId === authUser._id) return;

      let displayMessage = msg;
      if (msg.ciphertext) {
         const decryptedText = await decryptGroupMessage(msg, senderId, msg.senderId?.publicKey);
         displayMessage = { ...msg, text: decryptedText };
      }

      if (currentGrp && msg.groupId === currentGrp._id) {
        setMessages((prev) => [...prev, displayMessage]);
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
          text: displayMessage.text || (displayMessage.image ? "📷 Photo" : ""),
          createdAt: displayMessage.createdAt,
          isSender: false,
          senderName: displayMessage.senderId?.fullName || displayMessage.sender?.fullName || "Someone"
        }
      }));
  });

  socket.on("newMessage", async (newMessage) => {
    const currentUser = selectedUserRef.current;
   
    let displayMessage = newMessage;
    
    
    if (currentUser && newMessage.senderId._id === currentUser._id) {
      
     
      if (newMessage.encryptedMessage) {
        try {
          const isSender = false; // We are receiving it from socket
          const decryptedText = await decryptMessage(newMessage, isSender);
          displayMessage = { ...newMessage, text: decryptedText };
        } catch (error) {
          console.error("Local decryption failed for socket message:", error);
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

  socket.on("migrationStateChanged", async (data) => {
    const { groupId, migrationData, owner } = data;
    // We need to update the group in our local state
    setGroups(prevGroups => {
      return prevGroups.map(grp => {
        if (grp._id === groupId) {
          const updatedGrp = { ...grp, migrationData };
          if (owner) updatedGrp.owner = owner;
          
          // Verify asynchronously
          verifyAndPinGroupState(updatedGrp).then(isValid => {
             if (!isValid) {
               // We trigger a re-render by mutating state again if it's invalid
               setGroups(curr => curr.map(g => g._id === groupId ? { ...g, SECURITY_VIOLATION: updatedGrp.SECURITY_VIOLATION } : g));
             }
          });
          
          return updatedGrp;
        }
        return grp;
      });
    });
    
    // Also update selectedGrp if it's the one currently open
    if (selectedGrpRef.current && selectedGrpRef.current._id === groupId) {
        setSelectedGrp(prev => ({ ...prev, migrationData, ...(owner ? { owner } : {}) }));
    }
  });

  // ✅ Cleanup: remove listeners when component unmounts
  return () => {
    socket.off("newMessage");
    socket.off("newGroupMessage");
    socket.off("userTyping");
    socket.off("userStopTyping");
    socket.off("receiveGrpMsg");
    socket.off("messagesSeen");
    socket.off("messageSeen");
    socket.off("migrationStateChanged");
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
           await fetchGroups();
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

      const decryptedResults = await Promise.all(
        res.data.messages.map(async (msg) => {
          let text = msg.text;
          
          if (msg.encryptedMessage) {
             text = await decryptMessage(msg, msg.isSender);
          }

          if (!text && msg.image) {
            text = "📷 Photo";
          }
          
          return { ...msg, text };
        })
      );

      for (const msg of decryptedResults) {
        const otherUserId = msg.isSender ? 
          (msg.receiver._id || msg.receiver) : 
          (msg.sender._id || msg.sender);

        latest[otherUserId] = {
          text: msg.text,
          createdAt: msg.createdAt,
          seen: msg.seen || false,
          isSender: msg.isSender
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
    sendAIMessage,
    hasMoreMessages,
    nextCursor,
    isUsersLoading,
    isGroupsLoading
  }

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  )
}