import React, { useContext, useEffect, useRef, useState } from 'react'
import assets, { messagesDummyData } from '../assets/assets';
import { formatMessageTime } from '../lib/formatDateTime';
import { ChatContext } from '../../context/ChatContext';
import { AuthContext } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import Loading from './Loading';
import { Reply, Trash2, Copy, Languages } from "lucide-react";

const MainChat = () => {

  const {messages, selectedUser, setSelectedUser, sendMessage, getMessages, selectedProfile, setSelectedProfile, selectedProfileGrp, selectedGrpRef,
         setSelectedProfileGrp, selectedGrp, setSelectedGrp, sendGrpMsg, getGrpMessages, typingUsers, setTypingUsers, setMessages, setUnseenMessages, privateTypingUsers } = useContext(ChatContext);
  const {authUser, onlineUsers, socket} = useContext(AuthContext);
  const scrollEnd = useRef();
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [dropDownMsg, setDropDownMsg] = useState(false);
  const [optMsg, setOptMsg] = useState(null);

  // Handle sending a message
const handleSendMessage = async (e) => {
  e.preventDefault();
  if (input.trim() === "") return;

  // Make sure selectedUser has a publicKey
  if (selectedUser) {
  if (selectedUser && !selectedUser?.publicKey) {
    toast.error("Receiver's public key not available!");
    return;
  }

  await sendMessage({
    text: input.trim(),
    receiverPublicKey: selectedUser.publicKey
    //groupId: selectedGrp?._id  send groupId if group chat 🔹 required for encryption
  });
} else if (selectedGrp) {
    // group chat (plain)
    await sendGrpMsg({
      text: input.trim(),
      groupId: selectedGrp._id
    });
  }

  setInput("");
};



// Handle sending an image

const handleSendImage = async (e) =>{
const file = e.target.files[0];

if(!file || !file.type.startsWith("image/")){
toast.error("select an image file");
return;
}

const reader = new FileReader();
reader.onloadend = async () => {
  if (selectedUser) {
    await sendMessage({image: reader.result});
  } else if (selectedGrp) {
      await sendGrpMsg({ image: reader.result, groupId: selectedGrp._id });
    }
    e.target.value = ""
} 
  reader.readAsDataURL(file);
}


const getSenderId = (mes) => {
  return typeof mes.senderId === "object" ? mes.senderId._id : mes.senderId;
};


const isTyping = selectedUser ? !!typingUsers[selectedUser._id] : false;



const typingTimeout = useRef(null);

const handleTyping = (e) => {
  setInput(e.target.value);
  
  if (!socket) {
    console.log("❌ Socket not available");
    return;
  }

  console.log("⌨️ User is typing...");
  console.log("I am typing my id is ", authUser._id);
  // Emit typing event
  if (selectedGrp) {
    console.log("📤 Emitting typing to group:", selectedGrp._id);
    socket.emit("typing", {senderId: authUser._id, groupId: selectedGrp._id, senderName: authUser.fullName });
  } else if (selectedUser) {
    console.log("📤 Emitting typing to user:", selectedUser._id);
    socket.emit("typing", {senderId: authUser._id, receiverId: selectedUser._id, senderName: authUser.fullName });
  
      console.log("1", privateTypingUsers);
  }

  // Clear previous timeout
  clearTimeout(typingTimeout.current);
  
  // Set timeout to emit stop typing
  typingTimeout.current = setTimeout(() => {
    console.log("⏹️ Stopping typing indicator");
    if (selectedGrp) {
      socket.emit("stopTyping", { groupId: selectedGrp._id, senderId: authUser._id });
      
    } else if (selectedUser) {

      socket.emit("stopTyping", { receiverId: selectedUser._id, senderId: authUser._id });
      console.log("Uddi baba2");
      console.log("2", privateTypingUsers);
    }
    console.log("3", privateTypingUsers);
    
  }, 2000);
};

// Add cleanup on component unmount
useEffect(() => {
  return () => {
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    // Stop typing on unmount
    if (socket) {
      if (selectedGrp) {
        socket.emit("stopTyping", { groupId: selectedGrp._id, senderId: authUser._id });
      } else if (selectedUser) {
        console.log("Uddi baba");
        socket.emit("stopTyping", { receiverId: selectedUser._id, senderId: authUser._id });
      }
      
    }
  };
}, [selectedGrp, selectedUser, socket]);


useEffect(() => {
  console.log("🔍 Current typingUsers state:", typingUsers);
  console.log("🔍 Selected User:", selectedUser?._id);
  console.log("🔍 Selected Group:", selectedGrp?._id);
}, [typingUsers, selectedUser, selectedGrp]);



  useEffect(() => {
    if(selectedUser){
      setLoading(true); 
      getMessages(selectedUser._id);
      setTimeout(() => setLoading(false), 1000);
    } else if (selectedGrp) {
    setLoading(true);
    getGrpMessages(selectedGrp._id, true); // pass a flag to indicate group chat
    setTimeout(() => setLoading(false), 1000);
  }
  }, [selectedUser, selectedGrp]);

 
  

// Add this useEffect RIGHT AFTER your existing useEffects in MainChat.jsx
// This ensures users join group rooms for proper socket communication

useEffect(() => {
  if (socket && authUser && authUser.groups?.length) {
    const groupIds = authUser.groups.map(g => g._id || g);
    
    socket.emit("joinMultipleGroups", groupIds);

    // Optional cleanup when disconnecting
    return () => {
      
      socket.emit("leaveMultipleGroups", groupIds);
    };
  }
}, [socket, authUser]);


// Also add this debug useEffect to check if socket events are registered
useEffect(() => {
  if (socket) {
    console.log("🔌 Socket available:", !!socket);
    console.log("🔌 Socket connected:", socket.connected);
    console.log("🔌 Socket ID:", socket.id);
  }
}, [socket]);

  const handleCopy = async (text) => {
    // Copy text to clipboard
    navigator.clipboard.writeText(text);
      toast.success("Copied");
      setDropDownMsg(false);
  };










  
  return selectedUser || selectedGrp ? (
<div className={`h-full max-md:h-screen ${selectedGrp && "max-md:mt-[-41px]"} bg-[url("./src/assets/chatbg.png")] overflow-scroll relative backdrop-blur-lg`}>

<div className='flex items-center gap-3 backdrop-blur-[2px] py-3 mx-1 border-b border-stone-500'>
<div className="flex ">
  {/* User Avatar */}
  {selectedUser && (
    selectedUser.profilePic ? (
      <img
        src={selectedUser.profilePic}
        alt={selectedUser.fullName}
        onClick={() => setSelectedProfile(prev => !prev)}
        className="w-[33px] h-[33px] rounded-full object-cover border border-violet-500 ml-4 shadow-[0_0_8px_rgba(138,43,226,0.7)]"
      />
    ) : (
      <div
        className="w-[33px] h-[33px] ml-4 rounded-full flex items-center justify-center text-white text-[11px] font-bold border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)] bg-gradient-to-r from-[#ff4800] via-pink-500 to-[#d31b74]"
      >
        {selectedUser.fullName
          ?.split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)}
      </div>
    )
  )}



  {/* Group Avatar */}
  {selectedGrp && (
    selectedGrp.groupPic ? (
      <img
        src={selectedGrp.groupPic}
        alt={selectedGrp.groupName}
        onClick={() => setSelectedProfileGrp(prev => !prev)}  
        className="w-[33px] h-[33px] rounded-full object-cover border border-violet-500 ml-4 shadow-[0_0_8px_rgba(138,43,226,0.7)]"
      />
    ) : (
      <div
        className="w-[33px] h-[33px] ml-4 rounded-full flex items-center justify-center text-white text-[11px] font-bold border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)] bg-gradient-to-r from-[#ff4800] via-pink-500 to-[#d31b74]"
      >
        {selectedGrp.groupName
          ?.split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)}
      </div>
    )
  )}
</div>

<p 
onClick={() => {
  if(selectedGrp) setSelectedProfileGrp(prev => !prev)
    else setSelectedProfile(prev => !prev);
}}
className='flex-1 text-lg cursor-pointer text-white flex items-center gap-2'>
{selectedUser ? selectedUser.fullName : selectedGrp?.name}
 {selectedUser && onlineUsers.includes(selectedUser._id) && 
    <span className="w-2 h-2 rounded-full bg-green-500"></span>
  }
</p>


<img onClick={()=> {setSelectedUser(null); setSelectedGrp(null)}} src={assets.arrow_icon} alt="" className='md:hidden max-w-7'/>
<img src={assets.help_icon} alt="" className='max-md:hidden max-w-5 mx-3'/>
</div>
{/*Chat Area*/}
{loading ? (
      <div className="flex h-[calc(100%-120px)] items-center justify-center">
        <Loading size="lg" color="blue" text="Loading messages..." />
      </div>
    ) : (
<div className="flex flex-col h-[calc(100%-120px)] overflow-y-scroll p-4 pb-6 space-y-4 scrollbar-thin scrollbar-thumb-purple-600/30 scrollbar-track-transparent">
  {messages.length > 0 ? (<div>
  {messages.map((mes, i) => (
    <div 
      key={i} 
      className={`flex items-end gap-3 transition-all duration-300 ease-out animate-fadeIn ${
        getSenderId(mes) !== authUser._id ? "justify-start" : "justify-end"
      }`}
      style={{animationDelay: `${i * 0.05}s`}}
    >
      {/* Avatar for received messages (left side) */}
      {getSenderId(mes) !== authUser._id && (
  <div className="flex flex-col items-center gap-1 flex-shrink-0">
   {selectedGrp ? (
  mes.senderId?.profilePic ? (
    <img
      src={mes.senderId.profilePic}
      alt={mes.senderId.fullName}
      className="w-[33px] h-[33px] rounded-full object-cover border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)]"
    />
  ) : (
    <div
      className="w-[33px] h-[33px] rounded-full flex items-center justify-center 
        text-white text-[11px] font-bold border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)] 
        bg-gradient-to-r from-[#ff4800] via-pink-500 to-[#d31b74]"
    >
      {mes.senderId?.fullName
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)}
    </div>
  )
) : selectedUser ? (
  selectedUser.profilePic ? (
    <img
      src={selectedUser.profilePic}
      alt={selectedUser.fullName}
      className="w-[33px] h-[33px] rounded-full object-cover border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)]"
    />
  ) : (
    <div
      className="w-[33px] h-[33px] rounded-full flex items-center justify-center 
        text-white text-[11px] font-bold border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)] 
        bg-gradient-to-r from-[#ff4800] via-pink-500 to-[#d31b74]"
    >
      {selectedUser.fullName
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)}
    </div>
  )
) : null}

    {/* Show sender name in group chat */}
    {selectedGrp  ? (
      <p className="text-xs text-purple-400 font-semibold">
        {mes.senderId?.fullName || "Unknown"} 
        {console.log(mes.senderId)}
      </p>
    ) : (<p className="text-xs text-purple-400 font-semibold">
        {selectedUser.fullName || "Unknown"}
      </p>)}
    <p className="text-xs text-gray-400 font-medium">
      {formatMessageTime(mes.createdAt)}
    </p>
  </div>
)}
     
    


      {/* Message Content */}
      <div className={`flex flex-col max-w-[320px] ${mes.senderId === authUser._id ? 'items-end' : 'items-start'}`}>
        {/* Message Image (if exists) */}
         {selectedGrp &&
    getSenderId(mes) !== authUser._id &&
    mes.senderId?.fullName && (
      <span className="">
        
      </span>
    )}
        {mes.image ? (
          <div className={`relative group overflow-hidden rounded-2xl shadow-xl border-2 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] ${
            getSenderId(mes) === authUser._id 
              ? 'border-purple-500/40 bg-gradient-to-br from-purple-600/10 to-violet-600/10' 
              : 'border-gray-600/40 bg-gradient-to-br from-gray-700/10 to-gray-800/10'
          }`}>
            <img 
              src={mes.image} 
              alt="Shared image" 
              className="max-w-[230px] w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            {/* Image overlay icons */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
             
              <div className="flex gap-1">
                <div className="w-6 h-6 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative mt-6">
            <p 
              className={`px-4 py-3 max-w-[280px] text-sm font-light rounded-2xl shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl break-words leading-relaxed ${
                getSenderId(mes) === authUser._id 
                  ? "bg-gradient-to-br from-[#296dff] to-[#4f029d] border-2 border-purple-400/30 text-white rounded-br-md shadow-purple-500/20" 
                  : "bg-gradient-to-br from-gray-600/80 to-gray-900/90 border-2 border-gray-600/30 text-white rounded-bl-md shadow-gray-500/20"
              }`}
            >  
            <img src={assets.menu_icon} 
            onClick={() => {
              setDropDownMsg(prev => !prev)
              setOptMsg(mes);
            }}
            className="absolute cursor-pointer hover:scale-115 h-4 top-1.5 right-0 z=20"/>
       
              {mes.text}
            </p>
            
        <div className={`absolute border bg-sky-700 border-cyan-800 rounded-3xl p-2 flex flex-col top-10 right-0 z-50 items-center gap-2 ${dropDownMsg && optMsg == mes ? "" : "hidden"}`}>
        <div className="flex gap-2">
          <button className="p-2 cursor-pointer rounded-full bg-white/20 hover:bg-white/30 transition">
          <Reply className="w-5 h-5 text-white" />
        </button>
        <button className="p-2 cursor-pointer rounded-full bg-white/20 hover:bg-white/30 transition">
          <Languages className="w-5 h-5 text-white" />
        </button>
        </div>
        <div className="flex gap-2">
        <button onClick={() => handleCopy(mes.text)} className="p-2 cursor-pointer rounded-full bg-white/20 hover:bg-white/30 transition">
          <Copy className="w-5 h-5 text-white" />
        </button>
        <button className="p-2 cursor-pointer rounded-full bg-white/20 hover:bg-white/30 transition">
          <Trash2 className="w-5 h-5 text-white" />
        </button>
        </div>
      </div>
           
            
          </div>
        )}
      </div>

      {/* Avatar + Time for sent messages (right side) */}
      {getSenderId(mes) === authUser._id && (
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          {authUser?.profilePic ? (
                <img
                src={authUser.profilePic}
                alt={authUser.fullName}
                className="w-[33px] h-[33px] rounded-full object-cover border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)]"
                />
               ) : (
                     <div className="w-[33px] h-[33px] rounded-full flex items-center justify-center 
                      text-white text-[11px] font-bold border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)] 
                      bg-gradient-to-r from-[#ff4800] via-pink-500 to-[#d31b74]">
                      {authUser?.fullName
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                     </div>
                    )}
          {selectedGrp && (
      <p className="text-xs text-purple-400 font-semibold">
        {"You"}
      </p>
    )}
          <p className="text-xs text-gray-400 font-medium">{formatMessageTime(mes.createdAt)}</p>
        </div>
      )}
    </div>
  ))
 }</div>) : <p className="flex items-center h-full justify-center text-[15px]  text-blue-300">No Message yet !</p> }
  <div ref={scrollEnd}></div>
</div>
    )}




{/* Bottom Area */}
<div className='absolute bottom-0 left-0 right-0 flex items-center gap-3 p-3'>
  {/* TYPING INDICATOR - INDIVIDUAL CHAT */}
  {selectedUser && privateTypingUsers[selectedUser._id] && (
    <div className="absolute bottom-16 left-4 flex items-center" >
  <p className="text-sm text-blue-400 italic">
    {privateTypingUsers[selectedUser._id]} is typing...
  </p>
  </div>
)}
  {console.log(typingUsers)}
  {/* TYPING INDICATOR - GROUP CHAT */}
  {selectedGrp && 
   typingUsers && 
   typingUsers[selectedGrp._id] && 
   typeof typingUsers[selectedGrp._id] === 'object' && 
   Object.keys(typingUsers[selectedGrp._id]).length > 0 && (
    <div className="absolute bottom-16 left-4 flex items-center gap-2 text-xs text-green-300 bg-gray-800/70 px-3 py-1.5 rounded-full backdrop-blur-sm border border-gray-600/50 shadow-lg">
      <span className="font-medium text-green-400">
        {Object.values(typingUsers[selectedGrp._id])
          .slice(0, 2)
          .join(', ')}
        {Object.keys(typingUsers[selectedGrp._id]).length > 2 && 
          ` +${Object.keys(typingUsers[selectedGrp._id]).length - 2} more`}
      </span>
      <span>{Object.keys(typingUsers[selectedGrp._id]).length > 1 ? 'are' : 'is'} typing</span>
      <div className="flex gap-1 ml-1">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
      </div>
    </div>
  )}

<div className='flex-1 flex items-center bg-gray-100/12 px-3 rounded-full'>

          <input onChange={handleTyping} value={input} onKeyDown={(e) => e.key === "Enter" ? handleSendMessage(e) : null } type="text" placeholder="Send a message" className='flex-1 text-sm p-3 border-none rounded-lg outline-none text-white placeholder-gray-400'/>
          <input onChange={handleSendImage} type="file" id='image' accept='image/png, image/jpeg' hidden/>
          <label htmlFor="image">
                  <img src={assets.gallery_icon} alt="" className="w-5 mr-2 hover:w-5.5 cursor-pointer"/>
          </label>
          
</div>
<img onClick={handleSendMessage} src={assets.send_button} alt="" className="w-9 cursor-pointer hover:opacity-89" />
</div>

</div>
) : ( 
   <div className='flex flex-col items-center justify-center gap-2 text-gray-500 bg-white/10 max-md:hidden'>

<img src={assets.logo} className='max-w-56' alt="" />

<p className='text-lg font-medium text-white'>
Chat anytime, anywhere
</p>

</div>
  )
}

export default MainChat;
