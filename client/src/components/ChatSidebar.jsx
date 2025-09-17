import React, { useContext, useEffect, useState } from 'react'
import assets from '../assets/assets';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ChatContext } from '../../context/ChatContext';
import { LogOut, User2, UserPlus, UserPlus2, Users } from "lucide-react";
import toast from 'react-hot-toast';

const ChatSidebar = () => {

  const { getUsers, users, selectedUser, setSelectedUser, unseenMessages, setUnseenMessages, newGroupHandle, groups, setGroups, fetchGroups, selectedGrp, setSelectedGrp } = useContext(ChatContext);
  const { logout, onlineUsers } = useContext(AuthContext);
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

  const handleClickContact = () => {
    navigate("/contacts"); // redirect to contacts page
    setDropDown(false);
  };

  const handleClickGroup = () => {
      setNewGroup(true);
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

  useEffect(() => {
    getUsers();
    fetchGroups();
  }, [onlineUsers]);

  return (
    <div className={`bg-transparent relative h-full p-5 overflow-y-scroll border-r-2 border-r-gray-600 text-white  
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
            onClick={() => setDropDown(prev => !prev)}  
            className="w-8 h-8 cursor-pointer hover:scale-110 transition-transform duration-200 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
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
       

       {/* When User wants to create an new group */}
       <div className={`${newGroup ? "p-2 text-amber-500" : "hidden"} relative ` }>
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
                if(!newGroup){
                setSelectedUser(user);
                setSelectedGrp(null);
                setUnseenMessages((prev) => ({ ...prev, [user._id]: 0 }));
                }
              }}
              className={`relative flex items-center gap-3 p-3 cursor-pointer transition-all duration-300 rounded-lg
                ${isSelected && !newGroup
                  ? "bg-gradient-to-r from-violet-600/40 to-[#049cb0c6] shadow-[0_0_15px_rgba(255,0,255,0.5)]" 
                  : "hover:bg-gradient-to-r hover:from-violet-500/30 hover:to-[#09a3efb4] hover:shadow-[0_0_10px_rgba(255,0,255,0.3)]"
                }`}
            >

  
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
                <img
                src={user.profilePic}
                alt={user.fullName}
                className="w-[42px] h-[42px] rounded-full object-cover border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)]"
                />
               ) : (
                     <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center 
                      text-white text-sm font-bold border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)] 
                      bg-gradient-to-r from-[#ff4800] via-pink-500 to-[#d31b74]">
                      {user?.fullName
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                     </div>
                    )}
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











    <div className="flex flex-col divide-y divide-violet-500/20">
        {groups.map((group) => {
          const isSelected = selectedGrp?._id === group._id;
          //const unseenCount = unseenMessages[user._id] || 0;
          //const isOnline = onlineUsers.includes(user._id);

          return (
            <div
              key={group._id}
              onClick={() => {
                setSelectedGrp(group);
                setSelectedUser(null);
                //setUnseenMessages((prev) => ({ ...prev, [user._id]: 0 }));
                
              }}
              className={`relative flex items-center gap-3 p-3 cursor-pointer transition-all duration-300 rounded-lg
                ${isSelected
                  ? "bg-gradient-to-r from-violet-600/40 to-[#049cb0c6] shadow-[0_0_15px_rgba(255,0,255,0.5)]" 
                  : "hover:bg-gradient-to-r hover:from-violet-500/30 hover:to-[#09a3efb4] hover:shadow-[0_0_10px_rgba(255,0,255,0.3)]"
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
                {/*{isOnline && (
                  <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-400 rounded-full border border-gray-900 animate-ping"></span>
                )}*/}
              </div>

              {/* Name + Status */}
              <div className="flex-1 min-w-0">
                <p className="truncate font-semibold text-sm drop-shadow-[0_0_4px_rgba(255,255,255,0.6)]">{group.name}</p>
                {/*<p className={`text-xs ${isOnline ? "text-green-400" : "text-gray-400"}`}>
                  {isOnline ? "🟢 Online" : "⚫ Offline"}
                </p> */}
              </div>

              {/* Unseen Messages Badge 
              {unseenCount > 0 && (
                <span className="absolute top-1/2 -translate-y-1/2 right-4 text-xs h-5 w-5 flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 shadow-[0_0_10px_rgba(255,0,255,0.8)] text-white font-bold">
                  {unseenCount}
                </span>
              )}
                */}

            </div>
          );
        })}
      </div>












     
      {/* Plus sign overlay */}






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
