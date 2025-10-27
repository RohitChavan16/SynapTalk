import React, { useContext, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Users,
  Hash,
  Radio,
  Globe2,
  Bell,
  Bookmark,
  Settings,
  UserCircle,
  LogOut,
} from "lucide-react";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";

const SidebarMenu = () => {
  const {active, setActive, setSelectedUser, setSelectedGrp, setSelectedProfile, setSelectedProfileGrp, totalUserCount,
  totalGrpCount} = useContext(ChatContext);
  const { logout } = useContext(AuthContext);
  const [hovered, setHovered] = useState(null);
  const navigate = useNavigate();

  const menuItems = [
    { name: "My Chat", icon: MessageSquare },
    { name: "My Groups", icon: Users },
    { name: "Channels", icon: Hash },
    { name: "Live Spaces", icon: Radio },
    { name: "Notifications", icon: Bell },
    { name: "Saved Items", icon: Bookmark },
    { name: "Profile", icon: UserCircle },
    { name: "Settings", icon: Settings },
    { name: "Logout", icon: LogOut },
  ];

  return (
    <div className="relative bg-gradient-to-b from-[#0ba510e8] via-[#055f9f] to-[#5809c0f7] text-white shadow-2xl rounded-2xl p-3 flex flex-col items-center space-y-2">
      
      <div className="text-2xl font-bold mb-5 mt-2 tracking-wide">
        <span className="text-yellow-400">S</span>
      </div>

      <div className="flex flex-col justify-center space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.name}
              className={`relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 cursor-pointer
                ${
                  active === item.name
                    ? "bg-white/25 shadow-md"
                    : "hover:bg-white/15"
                }`}
              onClick={() => {
                setActive(item.name);
                setSelectedUser(null);
                setSelectedGrp(null);
                setSelectedProfile(null);
                setSelectedProfileGrp(null);
                if(item.name === "Profile"){
                   navigate("/profile");
                } else if(item.name === "Logout") {
                  const confirmed = window.confirm(
                  `Are you sure you want to logout ?`
                  );
                  if (!confirmed) return;
                   logout();
                }
              }}
              onMouseEnter={() => setHovered(item.name)}
              onMouseLeave={() => setHovered(null)}
            >
              <Icon size={22} />
               {item.name == "My Groups" && totalGrpCount > 0 && (
                <span className="absolute top-8 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-lg animate-bounce">
                {totalGrpCount > 99 ? '99+' : totalGrpCount}
                </span>
               )}
               {item.name == "My Chat" && totalUserCount > 0 && (
                <span className="absolute top-8 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-lg animate-bounce">
                {totalUserCount > 99 ? '99+' : totalUserCount}
                </span>
               )}
              {/* Tooltip-style text */}
              {hovered === item.name && (
                <motion.div
                  initial={{ opacity: 0, x: 0 }}
                  animate={{ opacity: 1, x: 8 }}
                  exit={{ opacity: 0, x: 0 }}
                  transition={{ duration: 0.25 }}
                  className="absolute z-50 top-8 left-6 bg-orange-500 text-white text-sm px-3 py-1 rounded-md shadow-lg whitespace-nowrap"
                >
                  {item.name}
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Section */}
      
      
    </div>
  );
};

export default SidebarMenu;
