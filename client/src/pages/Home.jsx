import React, { useContext, useState } from 'react'
import ChatSidebar from '../components/ChatSidebar';
import MainChat from '../components/MainChat';
import Profile from './Profile';
import ProfileSidebar from '../components/ProfileSidebar';
import { ChatContext } from '../../context/ChatContext';

const Home = () => {
  const {selectedUser, selectedProfile} = useContext(ChatContext);

  return (
    <div className="border w-full h-screen sm:px-[10%] sm:py-[5%]">
      <div className={`backdrop-blur-xl border-2 border-gray-600 rounded-2xl overflow-hidden h-[100%] grid relative
        ${selectedUser ? 
          `${selectedProfile ? 
            "md:grid-cols-[1fr_1.2fr_1fr] xl:grid-cols-[1fr_1.2fr_1fr]" : 
            "md:grid-cols-[1fr_1.5fr_0fr] xl:grid-cols-[1fr_1.2fr_0fr]"
          }` : 
          "md:grid-cols-2"
        }
        `}>
        <ChatSidebar />
        <MainChat />
        
        {/* Profile Sidebar - Always render when user selected, but control with grid and transitions */}
        {selectedUser && (
          <div className={`
            transition-all duration-500 ease-in-out overflow-hidden
            ${selectedProfile ? 
              "opacity-100 translate-x-0" : 
              "opacity-0 translate-x-full"
            }
          `}>
            <div className="w-full h-full">
              <ProfileSidebar />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Home;