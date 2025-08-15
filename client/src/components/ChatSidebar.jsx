import React, { useContext, useEffect, useState } from 'react'
import assets from '../assets/assets';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ChatContext } from '../../context/ChatContext';

const ChatSidebar = () => {

  const { getUsers, users, selectedUser, setSelectedUser, unseenMessages, setUnseenMessages } = useContext(ChatContext);
  const { logout, onlineUsers } = useContext(AuthContext);
  const navigate = useNavigate();
  const [input, setInput] = useState('');

  const filteredUsers = input
    ? users.filter((user) => user.fullName.toLowerCase().includes(input.toLowerCase()))
    : users;

  useEffect(() => {
    getUsers();
  }, [onlineUsers]);

  return (
    <div className={`bg-transparent h-full p-5 rounded-r-xl overflow-y-scroll text-white 
      ${selectedUser ? "max-md:hidden" : ""} 
      scrollbar-thin scrollbar-thumb-violet-500 scrollbar-track-transparent`}>

      {/* Header */}
      <div className="pb-5">
        <div className="flex justify-between items-center">
          <img src={assets.logo} alt="logo" 
            className="md:max-w-56 md:max-h-10 max-md:w-40 max-md:h-12 object-contain drop-shadow-[0_0_12px_rgba(138,43,226,0.8)]" 
          />

          {/* Dropdown Menu */}
          <div className="relative group">
            <img src={assets.menu_icon} alt="MenuIcon" 
              className="w-8 h-8 cursor-pointer hover:scale-110 transition-transform duration-200 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
            />
            <div className="absolute top-full right-0 z-20 w-40 mt-2 rounded-lg shadow-[0_0_25px_rgba(138,43,226,0.6)] bg-[#2B2548]/80 border border-violet-500 text-gray-200 hidden group-hover:block p-4 backdrop-blur-md">
              <p 
                onClick={() => { navigate('/profile') }} 
                className="cursor-pointer text-sm hover:text-violet-400 transition-colors"
              >
                ✨ Edit Profile
              </p>
              <hr className="my-2 border-violet-500/30" />
              <p 
                onClick={() => { logout() }} 
                className="cursor-pointer text-sm hover:text-red-400 transition-colors"
              >
                🚪 Logout
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-gradient-to-r from-purple-700/30 to-pink-500/30 rounded-full flex items-center gap-3 py-2.5 px-4 mt-5 border border-violet-500/40 focus-within:border-pink-400 transition-colors backdrop-blur-md">
          <img src={assets.search_icon} alt="Search Icon" className="w-4 h-4 opacity-80 drop-shadow-[0_0_4px_rgba(255,255,255,0.7)]" />
          <input 
            onChange={(e) => setInput(e.target.value)} 
            type="text" 
            className="bg-transparent border-none outline-none text-white text-sm placeholder-gray-400 flex-1"
            placeholder="🔍 Search User..." 
          />
        </div>
      </div>

      {/* Users List */}
      <div className="flex flex-col divide-y divide-violet-500/20">
        {filteredUsers.map((user) => {
          const isSelected = selectedUser?._id === user._id;
          const unseenCount = unseenMessages[user._id] || 0;
          const isOnline = onlineUsers.includes(user._id);

          return (
            <div
              key={user._id}
              onClick={() => {
                setSelectedUser(user);
                setUnseenMessages((prev) => ({ ...prev, [user._id]: 0 }));
              }}
              className={`relative flex items-center gap-3 p-3 cursor-pointer transition-all duration-300 rounded-lg
                ${isSelected 
                  ? "bg-gradient-to-r from-violet-600/40 to-[#049cb0c6] shadow-[0_0_15px_rgba(255,0,255,0.5)]" 
                  : "hover:bg-gradient-to-r hover:from-violet-500/30 hover:to-[#09a3efb4] hover:shadow-[0_0_10px_rgba(255,0,255,0.3)]"
                }`}
            >

              {/* Profile Picture */}
              <div className="relative">
                <img
                  src={user?.profilePic || assets.avatar_icon}
                  alt={user.fullName}
                  className="w-[42px] h-[42px] rounded-full object-cover border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)]"
                />
                {isOnline && (
                  <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-400 rounded-full border border-gray-900 animate-ping"></span>
                )}
              </div>

              {/* Name + Status */}
              <div className="flex-1 min-w-0">
                <p className="truncate font-semibold text-sm drop-shadow-[0_0_4px_rgba(255,255,255,0.6)]">{user.fullName}</p>
                <p className={`text-xs ${isOnline ? "text-green-400" : "text-gray-400"}`}>
                  {isOnline ? "🟢 Online" : "⚫ Offline"}
                </p>
              </div>

              {/* Unseen Messages Badge */}
              {unseenCount > 0 && (
                <span className="absolute top-1/2 -translate-y-1/2 right-4 text-xs h-5 w-5 flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 shadow-[0_0_10px_rgba(255,0,255,0.8)] text-white font-bold">
                  {unseenCount}
                </span>
              )}

            </div>
          );
        })}
      </div>
    </div>
  )
}

export default ChatSidebar;
