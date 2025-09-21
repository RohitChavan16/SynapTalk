import React, { useContext, useEffect, useRef, useState } from 'react'
import assets, { messagesDummyData } from '../assets/assets';
import { formatMessageTime } from '../lib/formatDateTime';
import { ChatContext } from '../../context/ChatContext';
import { AuthContext } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import Loading from './Loading';

const MainChat = () => {

  const {messages, selectedUser, setSelectedUser, sendMessage, getMessages, selectedProfile, setSelectedProfile, selectedGrp, setSelectedGrp, sendGrpMsg, getGrpMessages} = useContext(ChatContext);
  const {authUser, onlineUsers} = useContext(AuthContext);
  const scrollEnd = useRef();
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');

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

  useEffect(() => {
        if(scrollEnd.current && messages){ 
          scrollEnd.current.scrollIntoView({behavior: "smooth"})
        }
  },[messages]);

  return selectedUser || selectedGrp ? (
        <div className='h-full bg-[url("./src/assets/chatbg.png")] overflow-scroll relative backdrop-blur-lg'>

<div className='flex items-center gap-3 backdrop-blur-[2px] py-3 mx-1 border-b border-stone-500'>
<img 
onClick={() => setSelectedProfile(prev => !prev)}
src={selectedGrp ? assets.avatar_icon : selectedUser.profilePic || assets.avatar_icon} alt="" className="w-8 cursor-pointer rounded-full ml-3"/>

<p 
onClick={() => setSelectedProfile(prev => !prev)}
className='flex-1 text-lg cursor-pointer text-white flex items-center gap-2'>
{selectedUser ? selectedUser.fullName : selectedGrp?.name}
 {selectedUser && onlineUsers.includes(selectedUser._id) && 
    <span className="w-2 h-2 rounded-full bg-green-500"></span>
  }
</p>


<img onClick={()=> setSelectedUser(null)} src={assets.arrow_icon} alt="" className='md:hidden max-w-7'/>
<img src={assets.help_icon} alt="" className='max-md:hidden max-w-5 mx-3'/>
</div>
{/*Chat Area*/}
{loading ? (
      <div className="flex h-[calc(100%-120px)] items-center justify-center">
        <Loading size="lg" color="blue" text="Loading messages..." />
      </div>
    ) : (
<div className="flex flex-col h-[calc(100%-120px)] overflow-y-scroll p-4 pb-6 space-y-4 scrollbar-thin scrollbar-thumb-purple-600/30 scrollbar-track-transparent">
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
    <img 
      src={mes.senderId?.profilePic || assets.avatar_icon} 
      alt="" 
      className="w-8 h-8 rounded-full border-2 border-white/20 shadow-lg hover:border-purple-400/50 transition-all duration-300" 
    />
    {/* Show sender name in group chat */}
    {selectedGrp && (
      <p className="text-xs text-purple-400 font-semibold">
        {mes.senderId?.fullName || "Unknown"}
      </p>
    )}
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
          <div className="relative">
            <p 
              className={`px-4 py-3 max-w-[280px] text-sm font-light rounded-2xl shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl break-words leading-relaxed ${
                getSenderId(mes) === authUser._id 
                  ? "bg-gradient-to-br from-[#296dff] to-[#4f029d] border-2 border-purple-400/30 text-white rounded-br-md shadow-purple-500/20" 
                  : "bg-gradient-to-br from-gray-600/80 to-gray-900/90 border-2 border-gray-600/30 text-white rounded-bl-md shadow-gray-500/20"
              }`}
            >
              {mes.text}
            </p>
            
           
            
          </div>
        )}
      </div>

      {/* Avatar + Time for sent messages (right side) */}
      {getSenderId(mes) === authUser._id && (
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <img 
            src={
              authUser?.profilePic || assets.avatar_icon
            } 
            alt="" 
            className="w-8 h-8 rounded-full border-2 border-white/20 shadow-lg hover:border-purple-400/50 transition-all duration-300" 
          />
          {selectedGrp && (
      <p className="text-xs text-purple-400 font-semibold">
        {"You"}
      </p>
    )}
          <p className="text-xs text-gray-400 font-medium">{formatMessageTime(mes.createdAt)}</p>
        </div>
      )}
    </div>
  ))}
  <div ref={scrollEnd}></div>
</div>
    )}




{/* Bottom Area */}
<div className='absolute bottom-0 left-0 right-0 flex items-center gap-3 p-3'>
<div className='flex-1 flex items-center bg-gray-100/12 px-3 rounded-full'>

          <input onChange={(e)=>setInput(e.target.value)} value={input} onKeyDown={(e) => e.key === "Enter" ? handleSendMessage(e) : null } type="text" placeholder="Send a message" className='flex-1 text-sm p-3 border-none rounded-lg outline-none text-white placeholder-gray-400'/>
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
