import React, { useContext, useState } from 'react'
import ChatSidebar from '../components/ChatSidebar';
import MainChat from '../components/MainChat';
import Profile from './Profile';
import ProfileSidebar from '../components/ProfileSidebar';
import { ChatContext } from '../../context/ChatContext';
import GroupProfileSidebar from '../components/GroupProfileSidebar';
import MenuOption from '../components/MenuOption';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";

const Home = () => {
  const {selectedUser, selectedProfile, selectedGrp, selectedProfileGrp} = useContext(ChatContext);

  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="border w-full h-screen sm:px-[10%] sm:py-[5%]">
        <div className="fixed top-1/2 -translate-y-1/2 z-50 md:hidden">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`p-2 rounded-tr-lg cursor-pointer rounded-br-lg ${showMenu && "ml-22"} bg-amber-600 text-white hover:bg-gray-700 transition`}>
          {showMenu ? <X size={22} /> : <Menu size={22} />}
        </button>

      {/* 💻 Desktop Menu (always visible) */}
      <div className="absolute left-9 top-1/2 -translate-y-1/2 hidden md:block">
        <MenuOption />
      </div>

      {/* 📱 Mobile Sidebar */}
      <AnimatePresence>
        {showMenu && (
          <>
            {/* Background overlay */}
            <motion.div
              className="fixed inset-3 cursor-pointer z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
            />

            {/* Sliding Sidebar */}
            <motion.div
              initial={{ x: "-10%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed top-0 left-0 h-full w-26  text-white z-50 p-5 transparent text-right flex flex-col justify-center"
            >
              <MenuOption />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </div>
      <div className="absolute left-9 ">
        <MenuOption />
      </div>
      <div className={`backdrop-blur-xl border-2  border-gray-600 rounded-2xl overflow-hidden h-full grid relative
        ${selectedUser || selectedGrp ? 
          `${(selectedProfile || selectedProfileGrp) ? 
            "md:grid-cols-[1fr_1.2fr_1fr] xl:grid-cols-[1fr_1.2fr_1fr]" : 
            "md:grid-cols-[1fr_1.5fr_0fr] xl:grid-cols-[1fr_1.2fr_0fr]"
          }` : 
          "md:grid-cols-2"
        }
        `}>
        <ChatSidebar />
        <MainChat />
       

{selectedProfile && (
  <div className="hidden overflow-y-auto h-full md:block">
    <ProfileSidebar />
  </div>
)}
{selectedProfileGrp && (
  <div className="hidden overflow-y-auto h-full md:block">
    <GroupProfileSidebar />
  </div>
)}
<AnimatePresence>
  {(selectedProfile || selectedProfileGrp) && (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed top-0 right-0 z-50 w-80 h-full bg-gray-900 overflow-y-auto md:hidden"
    >
      {/* Render the actual sidebar content here */}
      {selectedProfile && <ProfileSidebar />}
      {selectedProfileGrp && <GroupProfileSidebar />}
    </motion.div>
  )}
</AnimatePresence>




      </div>
    </div>
  )
}

export default Home;