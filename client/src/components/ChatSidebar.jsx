import React, { useContext, useEffect, useState } from 'react'
import assets from '../assets/assets';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ChatContext } from '../../context/ChatContext';
import { LogOut, User2, UserPlus, UserPlus2, Users, Plus, X, Globe, Lock, Trash, Trash2Icon, Edit, Edit2Icon, Edit2, Menu } from "lucide-react";
import { 
  FaInstagram, 
  FaFacebook, 
  FaLinkedin, 
  FaGithub, 
  FaTwitter,
  FaYoutube,
  FaReddit,
  FaDiscord,
  FaPinterest,
  FaSnapchatGhost,
  FaTelegramPlane,
  FaMedium,
  FaDribbble,
  FaBehance,
  FaDev,
  FaStackOverflow,
  FaKaggle,
  FaCodepen,
  FaTwitch,
  FaSpotify
} from 'react-icons/fa';
  import {
  SiLeetcode,
  SiHackerrank,
  SiNotion
} from "react-icons/si";
import toast from 'react-hot-toast';
import MenuOption from './MenuOption';
import NotificationOptions from './Notification/NotificationOptions';


export const totalGrpCount = 0;

const ChatSidebar = () => {

  const { getUsers, users, selectedUser, setSelectedUser, unseenMessages, setUnseenMessages, newGroupHandle, groups, setGroups, fetchGroups, selectedGrp,
     setSelectedGrp, active, setActive, typingUsers, setTypingUsers, typingId, setTypingID, selectedGrpRef, 
     selectedUserRef, privateTypingUsers, setUnseenGrpMessages, unseenGrpMessages, latestMessages, setLatestMessages,
     fetchLatestMessages, latestGrpMessages, setLatestGrpMessages, fetchLatestGrpMessages, totalUserCount, setTotalUserCount, totalGrpCount, setTotalGrpCount } = useContext(ChatContext);
  const { logout, onlineUsers, socialLinks, getSocialLink, deleteSocialLink, addSocialLink, editSocialLink, socket, authUser } = useContext(AuthContext);
  const [dropDown, setDropDown] = useState(false);
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [newGroup, setNewGroup] = useState(false);
  const [selectedNewGroupMembers, setSelectedNewGroupMembers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupPrivacy, setGroupPrivacy] = useState("public");
  const [selectedGrpImg, setSelectedGrpImg] = useState("");
  const [socialMedia, setSocialMedia] = useState(false);
  const [editPlatform, setEditPlatform] = useState("");
  const [isEdit, setIsEdit] = useState(false);
  const [currentLink, setCurrentLink] = useState({ platform: "", url: "", privacy: "Public" });
  
  
  const allPlatforms = [
  "Instagram",
  "LinkedIn",
  "Facebook",
  "Twitter",
  "GitHub",
  "YouTube",
  "Reddit",
  "Discord",
  "Pinterest",
  "Snapchat",
  "Telegram",
  "LeetCode",
  "HackerRank"
];

  const handleClickContact = () => {
    navigate("/contacts"); // redirect to contacts page
    setDropDown(false);
  };

  const handleClickGroup = () => {
      setNewGroup(true);
      setActive("My Chat");
      setDropDown(false);
  }

   const handleCheckboxChange = (user) => {
    if (selectedNewGroupMembers.includes(user)) {
      // if already selected → remove
      setSelectedNewGroupMembers(selectedNewGroupMembers.filter((m) => m !== user));
    } else {
      // if not selected → add
      setSelectedNewGroupMembers([...selectedNewGroupMembers, user]);
    }
  };

  const CreateNewGroup = () => {
      if(selectedNewGroupMembers.length <= 1){
        toast.error("Select atleast any 2 member for a group");
      } else {
      setNewGroup(false);
      setShowModal(true);
      }
  }

  const handleUserClick = (user) => {
  setSelectedUser(user);       // set current user
  setSelectedGrp(null);        // deselect group
  setSelectedProfile(true);    // make sure profile sidebar is visible
};

  const handleDeleteLink = async (platform) => {
    if (!platform) {
    toast.error("Platform not selected");
    return;
  }
  await deleteSocialLink(platform);
  await getSocialLink();
  }

  const handleAddLink = async () => {
     await addSocialLink(currentLink);
     getSocialLink();
  }

  const handleEditLink = async () => {
    currentLink.platform = editPlatform;
     await editSocialLink({ ...currentLink});
     setEditPlatform("");
     setIsEdit(false);
     getSocialLink();
  }

  const cancelNewGroup = () => {
     setShowModal(false);
     setSelectedNewGroupMembers([]);
     setSelectedGrpImg("");
  }

  const handleCreateGroup = async(e) => {
    e.preventDefault();
    const groupData = {
      name: groupName,
      description: groupDesc,
      privacy: groupPrivacy,
      members: selectedNewGroupMembers,
    };
    setShowModal(false);
    setSelectedNewGroupMembers([]);
    
    if(!selectedGrpImg){
      await newGroupHandle({groupData});
      navigate("/");
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(selectedGrpImg);
    reader.onload = async () => {
      const base64Image = reader.result;
      await newGroupHandle({groupPic: base64Image, groupData});
      await fetchGroups(); 
      navigate("/");
      
    }
  }

  

  const filteredUsers = input
    ? users.filter((user) => user.fullName.toLowerCase().includes(input.toLowerCase()))
    : users;

  


  const iconMap = {
   Instagram: <FaInstagram className="text-pink-500" />,
  Facebook: <FaFacebook className="text-blue-500" />,
  LinkedIn: <FaLinkedin className="text-blue-400 w-10" />,
  GitHub: <FaGithub className="text-gray-300" />,
  Twitter: <FaTwitter className="text-sky-400" />,
  YouTube: <FaYoutube className="text-red-600" />,
  Reddit: <FaReddit className="text-orange-500" />,
  Discord: <FaDiscord className="text-indigo-500" />,
  Pinterest: <FaPinterest className="text-red-500" />,
  Snapchat: <FaSnapchatGhost className="text-yellow-400" />,
  Telegram: <FaTelegramPlane className="text-sky-500" />,
  Medium: <FaMedium className="text-gray-200" />,
  Dribbble: <FaDribbble className="text-pink-400" />,
  Behance: <FaBehance className="text-blue-400" />,
  "Dev.to": <FaDev className="text-white" />,
  "Stack Overflow": <FaStackOverflow className="text-orange-400" />,
  Kaggle: <FaKaggle className="text-sky-500" />,
  LeetCode: <SiLeetcode className="text-yellow-500" />,
  HackerRank: <SiHackerrank className="text-green-500" />,
  CodePen: <FaCodepen className="text-gray-400" />,
  Twitch: <FaTwitch className="text-purple-500" />,
  Spotify: <FaSpotify className="text-green-400" />,
  Notion: <SiNotion className="text-white" />,
  };
  useEffect(() => {
    getUsers();
    fetchGroups();
    getSocialLink();
    fetchLatestMessages();
    fetchLatestGrpMessages();
  }, [onlineUsers]);

  const sortedLinks = socialLinks
              .filter(sl => sl.url) // only render links with URL
              .sort((a, b) => b.msgCount - a.msgCount);
  

  // Add time formatting helper
const formatMessageTime = (timestamp) => {
  if (!timestamp) return "";
  
  const now = new Date();
  const msgTime = new Date(timestamp);
  const diffInHours = (now - msgTime) / (1000 * 60 * 60);
  
  // If today, show time
  if (diffInHours < 24 && now.getDate() === msgTime.getDate()) {
    return msgTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }
  
  // If yesterday
  if (diffInHours < 48 && now.getDate() - msgTime.getDate() === 1) {
    return "Yesterday";
  }
  
  // If within last week, show day name
  if (diffInHours < 168) {
    return msgTime.toLocaleDateString('en-US', { weekday: 'short' });
  }
  
  // Otherwise show date
  return msgTime.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
};




 
useEffect(() => {
  // Calculate total unseen user messages
  const userCount = Object.values(unseenMessages).reduce((sum, count) => sum + count, 0);
  setTotalUserCount(userCount);
  
  // Calculate total unseen group messages
  const grpCount = Object.values(unseenGrpMessages).reduce((sum, groupObj) => {
    return sum + (groupObj[authUser._id] || 0);
  }, 0);
  setTotalGrpCount(grpCount);
}, [unseenMessages, unseenGrpMessages, authUser._id]);





  return (
    <div className={`bg-transparent relative h-full p-5 overflow-y-scroll border-r-2 border-r-gray-600 text-white  
      ${selectedUser ? "max-md:hidden" : ""} 
      scrollbar-thin scrollbar-thumb-violet-500 scrollbar-track-transparent`}>
       
      {/* Header */}
      <div className="pb-5">
        <div className="flex justify-between  items-center">
          <img src={assets.logo} alt="logo" 
            className="md:max-w-56 md:max-h-12 max-md:w-15 max-md:ml-[-11px] object-contain drop-shadow-[0_0_12px_rgba(138,43,226,0.8)]" 
          />









         {/* Social Media List */}
         
          <div className="relative flex items-center h-11 max-md:h-9 max-md:ml-2 w-100 min-w-20 bg-gradient-to-r from-[#1b11de7b] to-[#76002f6a] border-2 border-emerald-600 shadow-[0_0_15px_rgba(55,0,255,0.6)] rounded-4xl">
  {/* Scrollable container */}
  <div className="flex gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-emerald-600 scrollbar-track-transparent px-3 pr-10 scroll-smooth">
    {sortedLinks.map((sl) =>
      sl.url && (
        <a
          key={sl.platform}
          href={
           sl.url.startsWith("http://") || sl.url.startsWith("https://")
           ? sl.url
           : `https://${sl.url}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="relative w-12 h-10 flex text-[19px] max-md:text-[16px] hover:text-xl items-center justify-center text-gray-200 hover:text-blue-500 transition-transform transform hover:scale-110 flex-shrink-0"
        >
          {iconMap[sl.platform] || sl.platform}
          {sl.msgCount > 0 && (
            <span className="absolute top-0 right-1 bg-red-500 text-white text-[11px] w-3 h-3 flex items-center justify-center rounded-full">
              {sl.msgCount}
            </span>
          )}
        </a>
      )
    )}
  </div>

  {/* Fixed Plus Button */}
  <Plus
    onClick={() => setSocialMedia((prev) => !prev)}
    className="absolute bg-amber-500 rounded-[3px] right-3 top-[9px] w-5 h-5 max-md:top-[8px] max-md:h-4 max-md:w-4 hover:scale-115 cursor-pointer z-10"
  />
</div>


          {socialMedia && (<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-[#07b9e6a2] via-[#c106518b] to-[#8910b2b7] text-white rounded-2xl border border-2 border-[#0cc487] shadow-2xl w-[90%] max-w-3xl p-8 relative animate-fadeIn">
            
            {/* Close Button */}
            <button
              onClick={() => setSocialMedia(false)}
              className="absolute top-4 right-4 text-gray-200 hover:text-white"
            >
              <X className="w-6 cursor-pointer h-6" />
            </button>

            {/* Title */}
            <h2 className="text-2xl font-bold mb-6">Manage Social Media</h2>

            {/* Social Links List */}
            <div className="space-y-4 mb-6 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
              {sortedLinks.map((sl, i) => (
                <div
  key={sl.platform}
  className="flex justify-between items-center bg-white/10 rounded-xl p-3 shadow hover:scale-[1.02] transition relative"
>
  {/* Left side */}
  <div className="flex items-center gap-3">
    <div className="text-2xl">{iconMap[sl.platform]}</div>
    <div>
      <p className="font-semibold">{sl.platform}</p>
      <a
        href={sl.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-200 hover:underline"
      >
        {sl.url}
      </a>
    </div>
  </div>

  {/* Right side */}
  <div className="flex cursor-pointer items-center gap-3">
    {sl.privacy === "Public" ? (
      <Globe className="w-5 h-5 text-green-300" />
    ) : (
      <Lock className="w-5 h-5 text-red-300" />
    )}

    {sl.msgCount > 0 && (
      <span className="bg-red-500 absolute top-15 -right-1 text-xs px-2 py-1 rounded-full">
        {sl.msgCount}
      </span>
    )}

    {/* Edit Button */}
    <button
      onClick={() => {
        setCurrentLink(sl);
        setEditPlatform(sl.platform);
        setIsEdit(true);
      }
      } // load into form
      className="text-yellow-400 cursor-pointer hover:text-yellow-300"
    >
      <Edit />
    </button>

    {/* Delete Button */}
    <button
      onClick={() => {
        handleDeleteLink(sl.platform)
      }}
      className="text-red-400 cursor-pointer hover:text-red-300"
    >
      <Trash2Icon />
    </button>
  </div>
</div>

))}
</div>

            







            
{/* Add New Social Link Form */}

<h3 className="text-lg font-semibold mb-3">
  {isEdit ? "Edit Link" : "Add New Link"}
</h3>
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
  <select
    value={currentLink.platform}
    onChange={(e) => setCurrentLink({ ...currentLink, platform: e.target.value })}
    className="p-2 rounded bg-white/20 border border-white/30 text-white placeholder-gray-300"
  >
  <option value="" className="bg-amber-500">Select Platform</option>
     
  {editPlatform && <option className="bg-indigo-400" key={editPlatform} value={editPlatform}>{editPlatform}</option>}
  {allPlatforms
    .filter(
      (platform) => !sortedLinks.some((sl) => sl.platform === platform)
    )
    .map((platform) => (
      <option className="bg-indigo-400" key={platform} value={platform}>
        {platform}
      </option>
    ))}
  </select>
  <input
    type="url"
    placeholder="URL"
    value={currentLink.url}
    onChange={(e) => setCurrentLink({ ...currentLink, url: e.target.value })}
    className="p-2 rounded bg-white/20 border border-white/30 text-white placeholder-gray-300"
  />
  <select
    value={currentLink.privacy}
    onChange={(e) => setCurrentLink({ ...currentLink, privacy: e.target.value })}
    className="p-2 cursor-pointer rounded bg-white/20 border border-white/30 text-white"
  >
    <option>Public</option>
    <option>Private</option>
  </select>
</div>
<button
  onClick={() => {
    if (!currentLink.platform || !currentLink.url) {
      toast.error("Platform and Url required!");
      return;
    }

    // if platform exists → update it
     if(isEdit){
       handleEditLink();
     } else {
       handleAddLink();
     }

    setCurrentLink({ platform: "", url: "", privacy: "Public" });
  }}
  className="w-full cursor-pointer hover:bg-emerald-600 py-2 bg-white text-indigo-700 font-bold rounded-lg transition"
>
  {isEdit ? "Save Changes" : "Add Link"}
</button>

  </div>
</div>
) }






          {/* Dropdown Menu */}
          
          <div className="relative group">
            <Menu 
            onClick={() => setDropDown(prev => !prev)}  
            className="w-8 h-8 max-md:w-6 max-md:h-6 max-md:ml-2 cursor-pointer hover:scale-110 transition-transform duration-200 rounded-full "
            />
            {dropDown &&
            <div className="absolute top-full right-0 z-20 w-40 mt-2 rounded-lg shadow-[0_0_25px_rgba(138,43,226,0.6)] bg-[#2B2548]/80 border border-violet-500 text-gray-200 p-4 backdrop-blur-md">
              <p 
                onClick={() => { navigate('/profile') }} 
                className="cursor-pointer text-sm hover:text-violet-400 transition-colors"
              >
                ✨ Edit Profile
              </p>
              
              <hr className="my-2 border-violet-500/30" />
              <p 
                onClick={handleClickContact} 
                className="cursor-pointer text-sm hover:text-blue-500 flex gap-2 items-center transition-colors"
              >
               <UserPlus2 className="w-5" /> Invite User
              </p>
              <hr className="my-2 border-violet-500/30" />
              <p 
                onClick={handleClickGroup} 
                className="cursor-pointer text-sm hover:text-green-400 flex gap-2 items-center transition-colors"
              >
               <Users className="w-5" /> New Group
              </p>
              <hr className="my-2 border-violet-500/30" />
              <p 
                onClick={() => { logout() }} 
                className="cursor-pointer text-sm hover:text-red-400 transition-colors"
              >
                🔐 Logout
              </p>
            </div>
            }
          </div>
           
        </div>
          






        {/*When User want to Search*/}
      { active !== "My Groups" &&
        <div className="bg-gradient-to-r from-purple-700/30 to-pink-500/30 rounded-full flex items-center gap-3 py-2.5 px-4 mt-5 border border-violet-500/40 focus-within:border-pink-400 transition-colors backdrop-blur-md">
          <img src={assets.search_icon} alt="Search Icon" className="w-4 h-4 opacity-80 drop-shadow-[0_0_4px_rgba(255,255,255,0.7)]" />
          <input 
            onChange={(e) => setInput(e.target.value)} 
            type="text" 
            className="bg-transparent border-none outline-none text-white text-sm placeholder-gray-400 flex-1"
            placeholder="🔍 Search User..." 
          />
        </div>
      }
 
      { active === "My Groups" &&
       <div className="bg-gradient-to-r from-purple-700/30 to-pink-500/30 rounded-full flex items-center gap-3 py-2.5 px-4 mt-5 border border-violet-500/40 focus-within:border-pink-400 transition-colors backdrop-blur-md">
          <img src={assets.search_icon} alt="Search Icon" className="w-4 h-4 opacity-80 drop-shadow-[0_0_4px_rgba(255,255,255,0.7)]" />
          <input 
            onChange={(e) => setInput(e.target.value)} 
            type="text" 
            className="bg-transparent border-none outline-none text-white text-sm placeholder-gray-400 flex-1"
            placeholder="🔍 Search group name..." 
          />
        </div>
      }

      </div>
       



      


      <p className="font-bold text-[13px] w-full flex items-center justify-center mb-3 mt-[-7px] text-[#00acd6d4]">{active}</p>



        {/* Normal Chat or Group Chat */}

       {/* When User wants to create an new group */}

       <div className={`${newGroup && active == "My Chat" ? "p-2 text-amber-500" : "hidden"} relative ` }>
         Add group members  :
         <div 
         onClick={CreateNewGroup}
         className={`text-amber-50 absolute right-15 top-1 border-2 border-emerald-300 cursor-pointer hover:opacity-80 bg-emerald-600 hover:text-indigo-600 font-bold px-3 py-1 rounded-2xl ${selectedNewGroupMembers.length > 0 ? "" : "hidden"}`}>
            Add +
         </div>
         <div onClick={() => setNewGroup(false)} className="absolute right-5 top-2 hover:scale-110 cursor-pointer">
          ❌
         </div>
       </div>









      {/*All Users List */}
    { active == "My Chat" && 
      <div className="flex flex-col divide-y divide-violet-500/20">
        {filteredUsers
        .sort((a, b) => {
        const timeA = latestMessages[a._id]?.createdAt 
        ? new Date(latestMessages[a._id].createdAt).getTime() 
        : 0;
        const timeB = latestMessages[b._id]?.createdAt 
        ? new Date(latestMessages[b._id].createdAt).getTime() 
        : 0; 
        return timeB - timeA;
        })
        .map((user) => {
          const isSelected = selectedUser?._id === user._id;
          const unseenCount = unseenMessages[user._id] || 0;
          const isOnline = onlineUsers.includes(user._id);

          const latestMsg = latestMessages[user._id];



          return (
            <div
              key={user._id}
              onClick={() => {
                if(!newGroup){
                setSelectedUser(user);
                setSelectedGrp(null);
                setUnseenMessages((prev) => ({ ...prev, [user._id]: 0 }));
                selectedUserRef.current = user;
                }
              }}
              className={`relative flex items-center gap-3 p-3 cursor-pointer transition-all duration-300 rounded-lg
                ${isSelected && !newGroup
                  ? "bg-gradient-to-r from-[#9300d299] to-[#049cb0c6] shadow-[0_0_15px_rgba(255,0,255,0.5)]" 
                  : "hover:bg-gradient-to-r hover:from-[#9300d299] hover:to-[#09a3efb4] hover:shadow-[0_0_10px_rgba(255,0,255,0.3)]"
                }`}
            >

          {/* Only Show this when user want to create a newGroup and this is a CheckBox to inlcude/exclude */}
          <input
            type="checkbox"
            id={`user-${user._id}`}
            checked={selectedNewGroupMembers.includes(user)}
            onChange={() => handleCheckboxChange(user)}
            className={`w-4 h-4 cursor-pointer ${newGroup ? "" : "hidden"}`}
          />
             

  {/* Profile Picture */}
  
  <div className="relative">
  {user?.profilePic ? (
    <div className="relative">
      {isOnline && (
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-400 via-emerald-500 to-green-400 animate-pulse blur-md opacity-75"></div>
      )}
      <img
        src={user.profilePic}
        alt={user.fullName}
        className={`relative w-[42px] h-[42px] rounded-full object-cover ${
          isOnline 
            ? 'border-2 border-green-400 animate-pulse shadow-[0_0_20px_rgba(74,222,128,0.8)]' 
            : 'border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)]'
        }`}
      />
    </div>
  ) : (
    <div className={`w-[42px] h-[42px] rounded-full flex items-center justify-center 
      text-white text-sm font-bold bg-gradient-to-r from-[#ff4800] via-pink-500 to-[#d31b74]
      ${isOnline 
        ? 'border-[3px] border-green-400 animate-none shadow-[0_0_20px_rgba(74,222,128,0.8)]' 
        : 'border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)]'
      }`}>
      {user?.fullName?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
    </div>
  )}
  {isOnline && (
    <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-400 rounded-full border-2 border-gray-900 shadow-[0_0_8px_rgba(74,222,128,1)] animate-bounce"></span>
  )}
</div>

              {/* Name + Status */}
            <div className="flex-1 min-w-0 ">
                <p className="truncate font-semibold text-sm drop-shadow-[0_0_4px_rgba(255,255,255,0.6)]">{user.fullName}</p>
                {latestMsg?.text && (
            <div className="flex items-center gap-1">
              <p className="truncate text-xs text-gray-400 max-w-[180px]">
                {latestMsg.isSender && <span className="text-blue-400">You: </span>}
                {latestMsg.text.length > 25 ? latestMsg.text.slice(0, 25) + "..." : latestMsg.text}
              </p>
              {!latestMsg.seen && latestMsg.isSender && (
                <span className="text-gray-500 text-xs">✓</span>
              )}
              {latestMsg.seen && latestMsg.isSender && (
                <span className="text-blue-400 text-xs">✓✓</span>
              )}
            </div>
          )}
          
          {!latestMsg?.text && (
            <p className={`text-xs ${isOnline ? "text-green-400" : "text-gray-400"}`}>
              {isOnline ? "🟢 Online" : "⚫ Offline"}
            </p>
          )}
              </div>

          {latestMsg?.createdAt && (
           <span className="absolute top-3 right-4 text-[10px] text-gray-400">
            {formatMessageTime(latestMsg.createdAt)}
           </span>
          )}

                {privateTypingUsers[user._id] && (
                 <div className="absolute bottom-2 right-4 z-100  flex items-center gap-2 text-[11px] text-green-300 bg-[#0a3a7c] px-3 py-1.5 rounded-full backdrop-blur-sm border border-gray-600/50 shadow-lg" >
                 <p className="text-[11px] text-blue-400 italic">
                 {privateTypingUsers[user._id]} is typing...
                 </p>
                 </div>
                )}
                
              {/* Unseen Messages Badge */}
              {unseenCount > 0 && (
                <span className="absolute top-1/2 -translate-y-1 right-4 text-xs h-4 w-4 flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 shadow-[0_0_10px_rgba(255,0,255,0.8)] text-white font-bold">
                  {unseenCount}
                </span>
              )}

            </div>
          );
        })}
      </div>

    }










  { active == "My Groups" &&
    <div className="flex flex-col divide-y divide-violet-500/20">
     
      { groups
        .sort((a, b) => {
    // First sort by latest message time
    const timeA = latestGrpMessages[a._id]?.createdAt 
      ? new Date(latestGrpMessages[a._id].createdAt).getTime() 
      : 0;
    const timeB = latestGrpMessages[b._id]?.createdAt 
      ? new Date(latestGrpMessages[b._id].createdAt).getTime() 
      : 0;
    return timeB - timeA;
  })
        .map((group) => {
          const isSelected = selectedGrp?._id === group._id;
          const unseenCount = unseenGrpMessages[group._id]?.[authUser._id] || 0;
          //const isOnline = onlineUsers.includes(user._id);
          
          const onlineCount = group.members?.filter(member =>
           onlineUsers.includes(member._id)
          ).length;
          
          const usersTyping = typingUsers[group._id];

          
          return (
            <div
              key={group._id}
              onClick={() => {
                setSelectedGrp(group);
                setSelectedUser(null);
                selectedGrpRef.current = group
                setUnseenGrpMessages((prev) => {
                 const updated = { ...prev };
                  if (updated[group._id]) {
                    delete updated[group._id][authUser._id];
                    if (Object.keys(updated[group._id]).length === 0) delete updated[group._id];
                  }
                 return updated;
                });
                
              }}
              className={`relative flex items-center gap-3 p-3 cursor-pointer transition-all duration-300 rounded-lg
                ${isSelected
                  ? "bg-gradient-to-r from-[#9300d299] to-[#049cb0c6] shadow-[0_0_15px_rgba(255,0,255,0.5)]" 
                  : "hover:bg-gradient-to-r hover:from-[#9300d299] hover:to-[#09a3efb4] hover:shadow-[0_0_10px_rgba(255,0,255,0.3)]"
                }`}
            >
             

              {/* Profile Picture */}
              <div className="relative">
               {group?.groupPic ? (
                <img
                src={group.groupPic}
                alt={group.name}
                className="w-[42px] h-[42px] rounded-full object-cover border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)]"
                />
               ) : (
                     <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center 
                      text-white text-sm font-bold border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)] 
                      bg-gradient-to-r from-[#ff4800] via-pink-500 to-[#d31b74]">
                      {group?.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                     </div>
                    )}
                
              </div>

              {/* Name + Status */}
              
              <div className="flex-1  min-w-0">
                <div className="flex">
                <p className="truncate font-semibold text-sm drop-shadow-[0_0_4px_rgba(255,255,255,0.6)]">{group.name}</p>
                <p className={`ml-2 mt-1 text-xs text-emerald-300`}>
                    {onlineCount > 1 ? `( ${onlineCount-1} Online )` : "(⚫ Offline)"}
                  </p>
                  </div>
                {latestGrpMessages[group._id]?.text ? (
                  <p className="truncate text-xs text-gray-400 max-w-[180px]">
                    {latestGrpMessages[group._id].isSender ? (
                      <span className="text-blue-400">You: </span>
                    ) : (
                      <span className="text-green-400">{latestGrpMessages[group._id].senderName}: </span>
                    )}
                    {latestGrpMessages[group._id].text.length > 25 
                      ? latestGrpMessages[group._id].text.slice(0, 25) + "..." 
                      : latestGrpMessages[group._id].text}
                  </p>
                ) : (
                  <p className={`text-xs`}>
                    No message yet...
                  </p>
                )}
              </div>

               {latestGrpMessages[group._id]?.createdAt && (
                <span className="absolute top-3 right-4 text-[10px] text-gray-400">
                  {formatMessageTime(latestGrpMessages[group._id].createdAt)}
                </span>
              )}
               
              {unseenCount > 0 && (
                <span className="absolute top-1/2 -translate-y-1 right-4 text-xs h-4 w-4 flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 shadow-[0_0_10px_rgba(255,0,255,0.8)] text-white font-bold">
                  {unseenCount}
                </span>
              )}
                

 {/* Typing indicator */}
          {usersTyping && Object.keys(usersTyping).length > 0 && (
           <div className="absolute bottom-2 right-2 z-100  flex items-center gap-2 text-xs text-green-300 bg-gray-800/70 px-3 py-1.5 rounded-full backdrop-blur-sm border border-gray-600/50 shadow-lg">
           <span className="font-medium text-green-400">
            {Object.values(usersTyping).slice(0, 2).join(', ')}
            {Object.keys(usersTyping).length > 2 && 
              ` +${Object.keys(usersTyping).length - 2} more`}
           </span>
           <span>{Object.keys(usersTyping).length > 1 ? 'are' : 'is'} typing</span>
           <div className="flex gap-1 ml-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
           </div>
           </div>
          )}


          </div>
          );
        })}
      </div>
  }

  {active === "Notifications" && <div>
     <NotificationOptions />
  </div> }

  {active === "My Chat" || active === "My Groups" || active === "Profile" || active === "Notifications" ? "" : (<div className="">
    <p className="flex justify-center h-90 items-center">Comming Soon !</p>
  </div>
  )}










     
    {/* New Group Details pop up */}

  {showModal && (
  <div className="absolute inset-0 bg-black/50 rounded-xl backdrop-blur-sm flex justify-center items-center z-20">
    <div className="bg-violet-500/30 backdrop-blur-3xl border border-blue-600  p-6 rounded-lg w-80 shadow-[1px_4px_60px_-12px_rgba(14,165,233,0.5)] ">
      <h2 className="text-xl font-bold mb-4">Create New Group</h2>
     
      <div className="mb-4">
          <label className="block text-gray-400 text-sm mb-1">Group Name</label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full border focus:outline-none focus:ring-0 border-[#858ad4b7] rounded-lg p-2 "
            placeholder="Enter group name"
          />
        </div>

        {/* Group Description */}
        <div className="mb-4">
          <label className="block text-gray-400 text-sm mb-1">Description</label>
          <textarea
            value={groupDesc}
            onChange={(e) => setGroupDesc(e.target.value)}
            className="w-full border focus:outline-none focus:ring-0 border-[#858ad4b7]  rounded-lg p-2"
            placeholder="Write something about the group..."
          />
        </div>
        

        {/* Privacy Setting */}
        <div className="mb-2">
          <label className="block text-gray-400 text-sm mb-1">Privacy</label>
          <select
            value={groupPrivacy}
            onChange={(e) => setGroupPrivacy(e.target.value)}
            className="w-full border cursor-pointer focus:outline-none focus:ring-0 border-[#858ad4b7] rounded-lg p-2 "
          >
            <option value="public" className="bg-orange-500 cursor-pointer ">🌍 Public</option>
            <option value="private" className="bg-orange-400 cursor-pointer">🔒 Private</option>
          </select>
        </div>
         


        {/* Group Profile Photo */}
 
         <div className="mb-2">
          <label className="block text-gray-300 text-sm mb-2">Group Photo</label>
            <label htmlFor="avatar" className='flex items-center gap-3 cursor-pointer'>
             <input onChange={(e)=>setSelectedGrpImg(e.target.files[0])} type="file" id='avatar' accept='.png, .jpg, .jpeg' hidden/>
              <img src={selectedGrpImg ? URL.createObjectURL(selectedGrpImg) : assets.avatar_icon } alt="" className={`w-12 h-12 ${selectedGrpImg && "rounded-full"}`} />
               Upload Image
             </label>
         </div>



        {/* Members Section */}
        <div className="mb-4">
          <label className="block text-gray-300 text-sm mb-2">Members</label>
          <div className="flex flex-wrap gap-3">
            {selectedNewGroupMembers.map((member) => (
              <div
                key={member._id}
                className="flex items-center gap-1 rounded-full"
              >
                 {member?.profilePic ? (
                <img
                src={member.profilePic}
                alt={member.fullName}
                className="w-[42px] h-[42px] rounded-full object-cover border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)]"
                />
               ) : (
                     <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center 
                      text-white text-sm font-bold border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)] 
                      bg-gradient-to-r from-[#ff4800] via-pink-500 to-[#d31b74]">
                      {member?.fullName
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                     </div>
                    )}
              </div>
            ))}
          </div>
        </div>

      <div className="flex justify-end space-x-13">
        
        <button onClick={handleCreateGroup} className="px-4 py-2 cursor-pointer bg-green-600 text-white rounded">
          Create Group
        </button>
        <button onClick={cancelNewGroup} className="px-4 py-2 bg-red-600/90  cursor-pointer rounded">
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
      
    
    </div>
  )
}

export default ChatSidebar;
