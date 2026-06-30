import React, { useContext, useEffect, useRef, useState } from 'react'
import assets, { messagesDummyData } from '../assets/assets';
import { formatMessageTime, formatDateLabel, isDifferentDay } from '../lib/formatDateTime';
import { ChatContext } from '../../context/ChatContext';
import { AuthContext } from '../../context/AuthContext';
import { CallContext } from '../../context/CallContext';
import toast from 'react-hot-toast';
import Loading from './Loading';
import { Reply, Trash2, Copy, Languages, Loader2, X, Smile, SendHorizonal, ImagePlus, Paperclip } from "lucide-react";
import { useLayoutEffect } from 'react';
import { MediaCryptoService } from '../lib/MediaCryptoService';
import axios from 'axios';
import { EncryptedMedia } from './EncryptedMedia';

const MainChat = () => {

  const {messages, selectedUser, setSelectedUser, sendMessage, getMessages, selectedProfile, 
    setSelectedProfile, selectedProfileGrp, selectedGrpRef,
    setSelectedProfileGrp, selectedGrp, setSelectedGrp, sendGrpMsg, getGrpMessages, 
    typingUsers, setTypingUsers, setMessages, setUnseenMessages, privateTypingUsers, sendAIMessage,
    hasMoreMessages, nextCursor } = useContext(ChatContext);
  const {authUser, onlineUsers, socket} = useContext(AuthContext);
  const { handleJoinCall, isInCall } = useContext(CallContext);
  const scrollEnd = useRef();
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [dropDownMsg, setDropDownMsg] = useState(false);
  const [optMsg, setOptMsg] = useState(null);
  const messagesEndRef = useRef(null);
  const activeAttachmentRef = useRef(null);

  const handleScroll = async (e) => {
    const { scrollTop, scrollHeight } = e.target;
    if (scrollTop === 0 && hasMoreMessages) {
      const oldScrollHeight = scrollHeight;
      if (selectedUser) {
        await getMessages(selectedUser._id, nextCursor);
      } else if (selectedGrp) {
        await getGrpMessages(selectedGrp._id, nextCursor);
      }
      setTimeout(() => {
        if (e.target) {
          e.target.scrollTop = e.target.scrollHeight - oldScrollHeight;
        }
      }, 0);
    }
  };

  // Handle sending a message
// Handle sending a message
const handleSendMessage = async (e) => {
  e?.preventDefault();
  if (input.trim() === "" && !selectedImageFile) return;
  if (isSending) return;

  setIsSending(true);

  try {
    const isAIMessage = input.trim().toLowerCase().startsWith("@saras");

    if (selectedImageFile) {
      let toastId = toast.loading("Encrypting and uploading...");
      try {
        const encryptedData = await MediaCryptoService.encryptMedia(selectedImageFile);
        
        const { data: sigData } = await axios.post('/api/upload/signature', {
          size: encryptedData.size,
          groupId: selectedGrp?._id || null,
          attachmentId: activeAttachmentRef.current
        });
        
        if (sigData.attachmentId) {
          activeAttachmentRef.current = sigData.attachmentId;
        }

        if (!sigData.success && sigData.status !== 'success') {
          throw new Error("Failed to get upload signature");
        }

        const uploadResponse = await fetch(sigData.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream'
          },
          body: encryptedData.encryptedBuffer
        });
        
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          throw new Error(`Upload failed (${uploadResponse.status}): ${errorText.substring(0, 50)}`);
        }

        await axios.post('/api/upload/complete', {
          attachmentId: sigData.attachmentId
        });

        const mediaPayload = {
          type: "media",
          media: {
            url: sigData.downloadUrl,
            aesKey: encryptedData.aesKey,
            iv: encryptedData.iv,
            sha256: encryptedData.sha256,
            mimeType: encryptedData.mimeType,
            size: encryptedData.size,
            name: encryptedData.name
          }
        };
        
        if (input.trim() !== "") {
          mediaPayload.text = input.trim();
        }

        const textPayload = JSON.stringify(mediaPayload);

        if (selectedUser) {
          await sendMessage({ text: textPayload, attachmentId: sigData.attachmentId, receiverPublicKey: selectedUser.publicKey });
        } else if (selectedGrp) {
          await sendGrpMsg({ text: textPayload, attachmentId: sigData.attachmentId, groupId: selectedGrp._id });
        }
        
        activeAttachmentRef.current = null;
        toast.success("Media sent securely!", { id: toastId });
        
        setSelectedImageFile(null);
        setImagePreviewUrl(null);
        setInput("");
      } catch (err) {
        console.error("FULL UPLOAD ERROR:", err);
        toast.error(err.response?.data?.message || err.message || "Failed to send media", { id: toastId });
      }
    } else {
      if (isAIMessage) {
        if (selectedUser) {
          if (!selectedUser?.publicKey) {
            toast.error("Receiver's public key not available!");
            return;
          }
          toast.loading("🤖 Saras AI is thinking...", { id: "ai-loading" });
          await sendMessage({
            text: input.trim(),
            receiverPublicKey: selectedUser.publicKey,
          });
          await sendAIMessage({
            text: input.trim(),
            receiverId: selectedUser._id,
          });
          toast.dismiss("ai-loading");
        } else if (selectedGrp) {
          toast.loading("🤖 Saras AI is thinking...", { id: "ai-loading" });
          await sendGrpMsg({
            text: input.trim(),
            groupId: selectedGrp._id,
          });
          await sendAIMessage({
            text: input.trim(),
            groupId: selectedGrp._id,
          });
          toast.dismiss("ai-loading");
        }
      } else {
        if (selectedUser) {
          if (!selectedUser?.publicKey) {
            toast.error("Receiver's public key not available!");
            return;
          }
          await sendMessage({
            text: input.trim(),
            receiverPublicKey: selectedUser.publicKey,
          });
        } else if (selectedGrp) {
          await sendGrpMsg({
            text: input.trim(),
            groupId: selectedGrp._id,
          });
        }
      }
      setInput("");
    }
  } finally {
    setIsSending(false);
  }
};

const handleImageSelect = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  setSelectedImageFile(file);
  setImagePreviewUrl(URL.createObjectURL(file));
  e.target.value = "";
};

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
  // Emit typing event
  if (selectedGrp) {
    socket.emit("typing", {senderId: authUser._id, groupId: selectedGrp._id, senderName: authUser.fullName });
  } else if (selectedUser) {
   
    socket.emit("typing", {senderId: authUser._id, receiverId: selectedUser._id, senderName: authUser.fullName });
   
  }

  // Clear previous timeout
  clearTimeout(typingTimeout.current);
  
  // Set timeout to emit stop typing
  typingTimeout.current = setTimeout(() => {
    if (selectedGrp) {
      socket.emit("stopTyping", { groupId: selectedGrp._id, senderId: authUser._id });
      
    } else if (selectedUser) {

      socket.emit("stopTyping", { receiverId: selectedUser._id, senderId: authUser._id });
    }
    
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
        socket.emit("stopTyping", { receiverId: selectedUser._id, senderId: authUser._id });
      }
      
    }
  };
}, [selectedGrp, selectedUser, socket]);






  useEffect(() => {
    const loadMessages = async () => {
      if (selectedUser) {
        setLoading(true); 
        await getMessages(selectedUser._id);
        setLoading(false);
      } else if (selectedGrp) {
        setLoading(true);
        await getGrpMessages(selectedGrp._id); // removed true argument which was acting as cursor
        setLoading(false);
      }
    };
    loadMessages();
  }, [selectedUser, selectedGrp]);

const scrollToBottom = (ref) => {
  if (!ref.current) return;
  ref.current.scrollIntoView({ behavior: "smooth" });
};
useLayoutEffect(() => {
  // Scroll whenever messages or selected chat changes
  scrollToBottom(messagesEndRef);
}, [messages, selectedUser?._id, selectedGrp?._id]);



// Also add this debug useEffect to check if socket events are registered


  const handleCopy = async (text) => {
    // Copy text to clipboard
    navigator.clipboard.writeText(text);
      toast.success("Copied");
      setDropDownMsg(false);
  };







  
  
  return selectedUser || selectedGrp ? (
<div className={`flex flex-col h-full max-md:h-screen ${selectedGrp && "max-md:mt-[-41px]"} bg-[url("./src/assets/chatbg.png")] bg-cover bg-center bg-no-repeat bg-fixed overflow-hidden relative backdrop-blur-lg`}>

<div className='flex items-center gap-3 bg-gradient-to-r from-white/10 to-transparent backdrop-blur-2xl py-3 px-4 mx-2 mt-2 rounded-2xl border border-white/10 shadow-lg relative z-20 transition-all'>
<button onClick={()=> {setSelectedUser(null); setSelectedGrp(null)}} className='md:hidden p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors'>
  <img src={assets.arrow_icon} alt="Back" className='w-5 h-5'/>
</button>

<div className="flex relative cursor-pointer" onClick={() => { if(selectedGrp) setSelectedProfileGrp(prev => !prev); else setSelectedProfile(prev => !prev); }}>
  {/* User Avatar */}
  {selectedUser && (
    selectedUser.profilePic ? (
      <img
        src={selectedUser.profilePic}
        alt={selectedUser.fullName}
        className="w-[42px] h-[42px] rounded-full object-cover border-2 border-violet-500 shadow-[0_0_10px_rgba(138,43,226,0.5)]"
      />
    ) : (
      <div
        className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-white text-[13px] font-bold border-2 border-violet-500 shadow-[0_0_10px_rgba(138,43,226,0.5)] bg-gradient-to-br from-[#ff4800] via-pink-500 to-[#d31b74]"
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
        className="w-[42px] h-[42px] rounded-full object-cover border-2 border-violet-500 shadow-[0_0_10px_rgba(138,43,226,0.5)]"
      />
    ) : (
      <div
        className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-white text-[13px] font-bold border-2 border-violet-500 shadow-[0_0_10px_rgba(138,43,226,0.5)] bg-gradient-to-br from-[#ff4800] via-pink-500 to-[#d31b74]"
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

<div 
  onClick={() => {
    if(selectedGrp) setSelectedProfileGrp(prev => !prev);
    else setSelectedProfile(prev => !prev);
  }}
  className='flex-1 cursor-pointer flex flex-col justify-center min-w-0'
>
  <div className="flex items-center gap-2">
    <h2 className='text-[17px] font-semibold text-white truncate drop-shadow-md'>
      {selectedUser ? selectedUser.fullName : selectedGrp?.name}
    </h2>
    {selectedUser && onlineUsers.includes(selectedUser._id) && 
      <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] flex-shrink-0"></span>
    }
  </div>
  <span className={`text-[12px] font-medium truncate ${selectedUser && onlineUsers.includes(selectedUser._id) ? 'text-green-400' : 'text-white/60'}`}>
    {selectedUser 
      ? (onlineUsers.includes(selectedUser._id) ? "Online now" : "Offline") 
      : (selectedGrp?.members?.length ? `${selectedGrp.members.length} members` : "Group chat")
    }
  </span>
</div>

<div className="flex items-center gap-1 sm:gap-2 text-gray-300">
  <button className="p-2.5 rounded-full hover:bg-white/10 hover:text-white transition-colors cursor-pointer max-sm:hidden" title="Search">
    <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
  </button>
  <button onClick={() => { if (selectedUser && !isInCall) handleJoinCall(selectedUser._id, selectedUser.fullName); }} disabled={isInCall} className="p-2.5 rounded-full hover:bg-white/10 hover:text-green-400 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" title="Voice Call">
    <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
  </button>
  <button onClick={() => { if (selectedUser && !isInCall) handleJoinCall(selectedUser._id, selectedUser.fullName); }} disabled={isInCall} className="p-2.5 rounded-full hover:bg-white/10 hover:text-blue-400 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" title="Video Call">
    <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
  </button>
  <button 
    onClick={() => {
      if(selectedGrp) setSelectedProfileGrp(prev => !prev);
      else setSelectedProfile(prev => !prev);
    }}
    className="p-2.5 rounded-full hover:bg-white/10 hover:text-white transition-colors cursor-pointer" title="More Options">
    <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
  </button>
</div>
</div>

{/* Migration State Banners */}
{selectedGrp && selectedGrp.migrationState === 'UPGRADING' && (
  <div className="bg-amber-500/20 backdrop-blur-md text-amber-300 px-4 py-2 text-xs flex justify-center items-center border-b border-amber-500/30 shadow-lg z-10">
    <span>⚠️ This group is upgrading to End-to-End Encryption. Generating and distributing keys...</span>
  </div>
)}
{selectedGrp && selectedGrp.migrationState === 'E2EE_ACTIVE' && (
  <div className="bg-emerald-500/20 backdrop-blur-md text-emerald-400 px-4 py-2 text-xs flex justify-center items-center border-b border-emerald-500/30 shadow-lg z-10">
    <span className="flex items-center gap-1">🔒 End-to-End Encryption is strictly enforced in this group.</span>
  </div>
)}

{/*Chat Area*/}
{loading ? (
      <div className="flex h-[calc(100%-120px)] items-center justify-center">
        <Loading size="lg" color="blue" text="Loading messages..." />
      </div>
    ) : (
<div 
  onScroll={handleScroll}
  className="flex flex-col flex-1 overflow-y-scroll p-4 pb-4 space-y-4 scrollbar-thin scrollbar-thumb-purple-600/30 scrollbar-track-transparent"
>
 
{messages.length > 0 ? (
  <div>
    {messages.map((mes, i) => {
      
      const showDateLabel = i === 0 || isDifferentDay(messages[i - 1].createdAt, mes.createdAt);
      
      return (
        <React.Fragment key={i}>
          {/* Date Separator */}
          {showDateLabel && (
            <div className="flex items-center justify-center my-4">
              <div className="bg-gray-800/70 backdrop-blur-sm px-4 py-1.5 rounded-full border border-gray-600/50 shadow-lg">
                <p className="text-xs font-medium text-gray-300">
                  {formatDateLabel(mes.createdAt)}
                </p>
              </div>
            </div>
          )}

          <div className={`flex items-end gap-2 my-2 ${getSenderId(mes) === authUser._id ? "justify-end" : "justify-start"}`}>
            
            {/* Avatar for received messages (left side) */}
            {getSenderId(mes) !== authUser._id && (
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                {selectedUser && selectedUser?.profilePic ? (
                  <img
                    src={selectedUser?.profilePic}
                    alt={selectedUser?.fullName}
                    className="w-[33px] h-[33px] rounded-full object-cover border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)]"
                  />
                ) : selectedGrp && mes.senderId?.profilePic ? (
                  <img
                    src={mes.senderId?.profilePic}
                    alt={mes.senderId?.fullName}
                    className="w-[33px] h-[33px] rounded-full object-cover border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)]"
                  />
                ) : (
                  <div className="w-[33px] h-[33px] rounded-full flex items-center justify-center 
                    text-white text-[11px] font-bold border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)] 
                    bg-gradient-to-r from-[#ff4800] via-pink-500 to-[#d31b74]">
                    {selectedGrp ? 
                       (mes.senderId?.fullName
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "U") 
                       : 
                       (selectedUser?.fullName
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "U")
                    }
                  </div>
                )}
                {selectedGrp && (
                  <p className="text-xs text-purple-400 font-semibold">
                    {mes.senderId?.fullName?.split(" ")[0] || "User"}
                  </p>
                )}
                <p className="text-xs text-gray-400 font-medium">{formatMessageTime(mes.createdAt)}</p>
              </div>
            )}

            {/* Message Bubble Container */}
            <div className={`relative max-w-[75%] sm:max-w-[65%] md:max-w-[55%] ${getSenderId(mes) === authUser._id ? "order-1" : "order-2"}`}>
              {/* Legacy Image Rendering */}
              {mes.image ? (
                <div className={`relative group flex flex-col overflow-hidden shadow-lg border-2 max-w-[280px] ${
                  getSenderId(mes) === authUser._id 
                    ? "bg-gradient-to-br from-[#296dff] to-[#4f029d] border-purple-400/30 shadow-purple-500/20 rounded-2xl rounded-br-md" 
                    : "bg-gradient-to-br from-gray-600/80 to-gray-900/90 border-gray-600/30 shadow-gray-500/20 rounded-2xl rounded-bl-md"
                }`}>
                  <img 
                    src={mes.image} 
                    alt="Shared image" 
                    className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105" 
                  />
                  {getSenderId(mes) === authUser._id && !selectedGrp && (
                    <div className="absolute bottom-2 right-2 bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded-full text-[10px]">
                      {mes.seen || mes.status === 'READ' ? (
                        <span className="text-blue-400 font-bold">✓✓</span>
                      ) : mes.status === 'DELIVERED' ? (
                        <span className="text-white font-bold">✓✓</span>
                      ) : (
                        <span className="text-white font-bold">✓</span>
                      )}
                    </div>
                  )}
                </div>
              ) : mes.mediaPayload ? (
                <div className={`relative group flex flex-col overflow-hidden shadow-lg border-2 max-w-[280px] ${
                  getSenderId(mes) === authUser._id 
                    ? "bg-gradient-to-br from-[#296dff] to-[#4f029d] border-purple-400/30 shadow-purple-500/20 rounded-2xl rounded-br-md" 
                    : "bg-gradient-to-br from-gray-600/80 to-gray-900/90 border-gray-600/30 shadow-gray-500/20 rounded-2xl rounded-bl-md"
                }`}>
                  <EncryptedMedia payload={mes.mediaPayload.media} className="!max-w-none w-full" />
                  
                  {mes.mediaPayload.text && (
                    <div className="px-3 py-2 text-white text-sm font-light break-words border-t border-white/10">
                      {mes.mediaPayload.text}
                    </div>
                  )}

                  {getSenderId(mes) === authUser._id && !selectedGrp && (
                    <div className="absolute bottom-2 right-2 bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded-full text-[10px]">
                      {mes.seen || mes.status === 'READ' ? (
                        <span className="text-blue-400 font-bold">✓✓</span>
                      ) : mes.status === 'DELIVERED' ? (
                        <span className="text-white font-bold">✓✓</span>
                      ) : (
                        <span className="text-white font-bold">✓</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative mt-6">
                  {mes.text?.startsWith("🤖 Saras AI:") ? (
                    <div className="px-4 py-3 max-w-[300px] text-sm rounded-2xl shadow-lg backdrop-blur-sm bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border border-cyan-400/40 text-white break-words leading-relaxed">
                      <span className="font-bold text-cyan-100 mb-1 block">Saras AI 🤖</span>
                      {mes.text.replace("🤖 Saras AI:", "").split("\n").map((line, idx) => {
                        if (/^\d+\./.test(line)) {
                          return (
                            <div key={idx} className="ml-4 list-decimal list-inside">
                              {line.replace(/^\d+\.\s*/, "")}
                            </div>
                          );
                        } else if (/^\*/.test(line)) {
                          return (
                            <div key={idx} className="ml-4 list-disc list-inside text-gray-200">
                              {line.replace(/^\*\s*/, "")}
                            </div>
                          );
                        }
                        return <p key={idx}>{line}</p>;
                      })}
                    </div>
                  ) : (
                    <p 
                      className={`px-4 py-3 max-w-[280px] text-sm font-light rounded-2xl shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl break-words leading-relaxed ${
                        getSenderId(mes) === authUser._id 
                          ? "bg-gradient-to-br from-[#296dff] to-[#4f029d] border-2 border-purple-400/30 text-white rounded-br-md shadow-purple-500/20" 
                          : "bg-gradient-to-br from-gray-600/80 to-gray-900/90 border-2 border-gray-600/30 text-white rounded-bl-md shadow-gray-500/20"
                      }`}
                    >  
                      <img 
                        src={assets.menu_icon} 
                        onClick={() => {
                          setDropDownMsg(prev => !prev)
                          setOptMsg(mes);
                        }}
                        className="absolute cursor-pointer hover:scale-115 h-4 top-1.5 right-0 z-20"
                      />
                      <span className="break-words whitespace-pre-wrap">{mes.text}</span>
                      {getSenderId(mes) === authUser._id && !selectedGrp && (
                        <span className="inline-flex items-center ml-2 text-[11px] opacity-90 align-bottom relative top-[2px]">
                          {mes.seen || mes.status === 'READ' ? (
                            <span className="text-blue-300 font-bold drop-shadow-md tracking-tighter">✓✓</span>
                          ) : mes.status === 'DELIVERED' ? (
                            <span className="text-gray-300 font-bold drop-shadow-md tracking-tighter">✓✓</span>
                          ) : (
                            <span className="text-gray-300 font-bold drop-shadow-md">✓</span>
                          )}
                        </span>
                      )}
                    </p>
                  )}
                  
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
        </React.Fragment>
      );
    })}
  </div>
) : (
  <p className="flex items-center h-full justify-center text-[15px] text-blue-300">No Message yet!</p>
)}
  <div ref={messagesEndRef} />
  </div>
)}




{/* Bottom Area */}
{selectedGrp?.SECURITY_VIOLATION ? (
  <div className='absolute bottom-0 left-0 right-0 bg-red-900/90 border-t border-red-500/50 p-4 flex flex-col items-center justify-center text-center backdrop-blur-md z-50'>
      <div className="flex items-center gap-2 text-red-200 font-bold mb-1">
        <span className="text-xl">🔒</span>
        <span>Security Violation Detected</span>
      </div>
      <p className="text-red-200/80 text-xs">
        {selectedGrp.SECURITY_VIOLATION}
      </p>
      <p className="text-red-300/60 text-[10px] mt-1 uppercase tracking-wider font-semibold">Messaging Suspended</p>
  </div>
) : (
<div className='flex items-center gap-3 p-3 bg-transparent backdrop-blur-2xl border border-white/20 mx-2 mb-2 rounded-full relative z-20 flex-shrink-0 shadow-lg'>
  {/* TYPING INDICATOR - INDIVIDUAL CHAT */}
  {selectedUser && privateTypingUsers[selectedUser._id] && (
    <div className="absolute bottom-16 left-6 flex items-center" >
  <div className="flex gap-0 items-center">
            <style>{`
              @keyframes morph1 {
                0%, 100% { transform: scale(1) translateX(0); opacity: 1; }
                50% { transform: scale(1.5) translateX(4px); opacity: 0.7; }
              }
              @keyframes morph2 {
                0%, 100% { transform: scale(1) translateX(0); opacity: 1; }
                50% { transform: scale(1.5) translateX(0); opacity: 0.7; }
              }
              @keyframes morph3 {
                0%, 100% { transform: scale(1) translateX(0); opacity: 1; }
                50% { transform: scale(1.5) translateX(-4px); opacity: 0.7; }
              }
              .morph1 { animation: morph1 1.4s ease-in-out infinite; }
              .morph2 { animation: morph2 1.4s ease-in-out infinite 0.2s; }
              .morph3 { animation: morph3 1.4s ease-in-out infinite 0.4s; }
            `}</style>
            <span className="morph1 w-3 h-3 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full shadow-lg shadow-cyan-500/50"></span>
            <span className="morph2 w-3 h-3 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full shadow-lg shadow-blue-500/50 -ml-1"></span>
            <span className="morph3 w-3 h-3 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full shadow-lg shadow-purple-500/50 -ml-1"></span>
          </div>
  </div>
)}
  
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

{imagePreviewUrl && (
  <div className="absolute bottom-[100%] left-4 mb-2 bg-gray-800/90 p-2 rounded-xl shadow-xl border border-gray-600 z-50 flex flex-col gap-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
    <div className="relative group">
      <img src={imagePreviewUrl} alt="Preview" className="h-32 w-auto max-w-[200px] rounded-lg object-cover border border-gray-500/50" />
      <button 
        onClick={() => { setSelectedImageFile(null); setImagePreviewUrl(null); }}
        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 hover:scale-110 transition-all shadow-lg cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>

)}



<div className='flex-1 flex items-center bg-gray-100/12 px-3 rounded-full relative'>

          <input onChange={handleTyping} value={input} onKeyDown={(e) => e.key === "Enter" ? handleSendMessage(e) : null } type="text" placeholder="Send a message" className='flex-1 text-sm p-3 border-none rounded-lg outline-none text-white placeholder-gray-400'/>
          <input onChange={handleImageSelect} type="file" id='image' accept='image/png, image/jpeg' hidden/>
          <label htmlFor="image">
                  <img src={assets.gallery_icon} alt="" className="w-5 mr-2 hover:w-5.5 cursor-pointer"/>
          </label>
          
</div>
{isSending ? (
  <Loader2 className="w-9 h-9 animate-spin text-white opacity-80" />
) : (
  <img onClick={handleSendMessage} src={assets.send_button} alt="" className="w-9 cursor-pointer hover:opacity-89" />
)}
</div>
)}

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
