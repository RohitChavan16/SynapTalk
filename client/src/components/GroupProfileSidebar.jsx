import React, { useContext, useEffect, useRef, useState } from 'react';
import assets from '../assets/assets';
import { ChatContext } from '../../context/ChatContext';
import { 
  Users, 
  FileText, 
  Link, 
  Video as VideoIcon, 
  Music, 
  ChevronRight, 
  Archive,
  Pin,
  Download,
  Share,
  Trash2,
  Shield,
  Ban,
  UserCheck,
  Crown,
  UserMinus,
  UserPlus,
  Edit3,
  Check,
  X
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import GroupInfoCard from './GroupInfoCard';
import toast from 'react-hot-toast';
import axios from 'axios';

const GroupProfileSidebar = () => {
  const { selectedGrp, messages, setSelectedProfileGrp, updateGrp } = useContext(ChatContext);
  const {onlineUsers, authUser} = useContext(AuthContext);
  const [msgImages, setMsgImages] = useState([]);
  const [msgDocs, setMsgDocs] = useState([]);
  const [msgLinks, setMsgLinks] = useState([]);
  const [msgAudios, setMsgAudios] = useState([]);
  const [msgVideos, setMsgVideos] = useState([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [grpName, setGrpName] = useState(selectedGrp.name || "");
  const [grpImage, setGrpImage] = useState(selectedGrp.groupPic);
  const [grpFile, setGrpFile] = useState(null);
  const fileInputRef = useRef(null);


  useEffect(() => {
    if (!selectedGrp) return;

    setMsgImages(messages.filter(msg => msg.image).map(msg => msg.image));
    setMsgDocs(messages.filter(msg => msg.document || msg.file).map(msg => msg.document || msg.file));
    setMsgLinks(messages.filter(msg => msg.link || (msg.text && msg.text.includes('http'))).map(msg => msg.link || msg.text));
    setMsgAudios(messages.filter(msg => msg.audio).map(msg => msg.audio));
    setMsgVideos(messages.filter(msg => msg.video).map(msg => msg.video));
  }, [messages, selectedGrp]);
 const isAdmin = selectedGrp.admins?.some(
    (admin) => (admin._id ? admin._id.toString() : admin.toString()) === authUser._id
  );
  const ProfileOption = ({ title, subtitle, rightElement, color = "text-white" }) => (
    <div className={`flex items-center justify-between p-3 cursor-pointer hover:bg-white/10 transition-colors rounded-lg mx-2 my-1 ${color}`}>
      <div className="flex flex-col">
        <span className="font-medium text-sm">{title}</span>
        {subtitle && <span className="text-xs text-white/60">{subtitle}</span>}
      </div>
      {rightElement}
    </div>
  );

  const MediaSection = ({ title, items, type }) => (
    items.length > 0 && (
      <div className="px-5 text-xs mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-white/80">{title} ({items.length})</p>
          <button className="text-blue-300 hover:text-blue-200 text-xs">View All</button>
        </div>
        <div className="mt-2 max-h-[150px] overflow-y-scroll grid grid-cols-2 gap-2 opacity-80">
          {items.slice(0, 6).map((item, index) => (
            <div key={index} onClick={() => window.open(item)} className='cursor-pointer rounded hover:scale-105 transition-transform'>
              {type === 'images' && <img src={item} alt="" className='h-20 w-full object-cover rounded-md' />}
              {type === 'documents' && <div className="h-20 flex flex-col items-center justify-center rounded-md bg-gray-700/50"><FileText className="w-6 h-6 text-blue-300 mb-1" /><span className="text-xs text-white/70">Document</span></div>}
              {type === 'videos' && <div className="h-20 flex flex-col items-center justify-center rounded-md bg-gray-800/50"><VideoIcon className="w-6 h-6 text-red-300 mb-1" /><span className="text-xs text-white/70">Video</span></div>}
              {type === 'audios' && <div className="h-20 flex flex-col items-center justify-center rounded-md bg-green-800/30"><Music className="w-6 h-6 text-green-300 mb-1" /><span className="text-xs text-white/70">Audio</span></div>}
              {type === 'links' && <div className="h-20 flex flex-col items-center justify-center rounded-md bg-purple-800/30"><Link className="w-6 h-6 text-purple-300 mb-1" /><span className="text-xs text-white/70 truncate px-1">Link</span></div>}
            </div>
          ))}
        </div>
      </div>
    )
  );

  const sortedMembers = [...selectedGrp.members].sort((a, b) => {
  const isAYou = a._id === authUser._id;
  const isBYou = b._id === authUser._id;

  const isAAdmin = selectedGrp.admins?.some(admin =>
    (admin._id ? admin._id.toString() : admin.toString()) === a._id
  );
  const isBAdmin = selectedGrp.admins?.some(admin =>
    (admin._id ? admin._id.toString() : admin.toString()) === b._id
  );

  // 1️⃣ "You" first
  if (isAYou && !isBYou) return -1;
  if (!isAYou && isBYou) return 1;

  // 2️⃣ Admins next
  if (isAAdmin && !isBAdmin) return -1;
  if (!isAAdmin && isBAdmin) return 1;

  // 3️⃣ Others last
  return 0;
});


const handleSave = async (newDesc) => {

  if (grpFile) {

   const reader = new FileReader();
    reader.readAsDataURL(grpFile);
    reader.onload = async () => {
    const base64Image = reader.result;
    await updateGrp({grpId: selectedGrp._id, grpName, description: newDesc, grpImage: base64Image});
    }
  } else {
  await updateGrp({grpId: selectedGrp._id, grpName, description: newDesc });
  }
    setIsEditingName(false);
}

const updateImage = () => {
   if (!isAdmin) {
      toast.error("Only admins can update group picture");
      return;
    }
    fileInputRef.current.click();
    
}

const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Only images allowed");
    setGrpFile(file);
    setGrpImage(URL.createObjectURL(file));    
  };

  return selectedGrp && (
    <div className="bg-[#8185B2]/10 text-white w-full relative border-l-2 border-l-gray-600 h-[100%] overflow-y-scroll ">
      <button
        className="absolute top-3 right-3 p-2 text-white md:hidden"
        onClick={() => setSelectedProfileGrp(false)}
      >
        X
      </button>
      {/* Group Header */}
      <div className='pt-10 flex flex-col items-center gap-2 text-xs font-light mx-auto'>
        
        {grpImage ? (
                <img
                src={grpImage}
                alt={selectedGrp.name}
                onClick={updateImage}
                className="w-[82px] h-[82px] rounded-full object-cover border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)]"
                title="Edit image"
                />
               ) : (
                     <div onClick={updateImage} className="w-[82px] h-[82px] rounded-full flex items-center justify-center 
                      text-white text-xl font-bold border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)] 
                      bg-gradient-to-r from-[#ff4800] via-pink-500 to-[#d31b74]">
                      {selectedGrp?.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                     </div>
                    )}
        <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        />
        
        <div className={`relative ${isEditingName && "w-full px-3"}`}>
          {isEditingName ? ( <div>
          <input
            type="text"
            value={grpName}
            onChange={(e) => setGrpName(e.target.value)}
            className="w-full bg-[#101020] text-white/90 text-base font-semibold px-3 py-2 rounded-lg border border-violet-500/30 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/40 outline-none transition-all duration-200"
          />
          <div className="flex justify-end mt-2 gap-2">
            <button
              onClick={() => {setIsEditingName(false);
                setGrpName(selectedGrp.name)} }
              className="px-3 py-1.5 text-xs hover:font-bold cursor-pointer text-gray-300 border-[2px] hover:bg-[#b60546] border-[#e70008] rounded-lg transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-xs cursor-pointer bg-violet-600/80 hover:bg-violet-800 transition-all text-white font-medium rounded-lg flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> Save
            </button>
          </div> 
          </div>
        ) : (
        <h1 className='px-10 text-xl font-semibold mx-auto'>{selectedGrp.name}</h1>
        )}
        {selectedGrp.admins?.some(admin =>
          (admin._id ? admin._id.toString() : admin.toString()) === authUser._id) && (
            <button
              onClick={() => setIsEditingName(true)}
              className="absolute top-2 right-3 opacity-80 hover:opacity-100  transition-opacity duration-200 text-violet-400 hover:text-violet-300"
              title="Edit Group Name"
            >
              <Edit3 className="w-4 h-4 cursor-pointer hover:scale-110" />
            </button>
          )}
        </div>
        <GroupInfoCard
         description={selectedGrp.description}
         isAdmin={selectedGrp.admins?.some(admin =>
         (admin._id ? admin._id.toString() : admin.toString()) === authUser._id
         )}
         onSave={(newDesc) => handleSave(newDesc)}
        />

      </div>

      <hr className="border-[#ffffff50] my-4"/>

      {/* Members List */}
     <div className="px-5 mb-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white/90 text-sm font-semibold tracking-wide">
          Group Members
        </h2>
        { selectedGrp.admins?.some(admin =>
          (admin._id ? admin._id.toString() : admin.toString()) === authUser._id) && 
        <button
          className="flex mb-2 gap-1 items-center cursor-pointer justify-center p-2 rounded bg-violet-600/10 border-2 border-[#ff8c20] hover:bg-violet-600/30 transition-all duration-200 group"
        >
          <UserPlus className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
          <span className="text-[14px] text-white/80 mt-1 font-medium">Add</span>
        </button>
        }
        <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded-full">
          {selectedGrp.members.length} {selectedGrp.members.length === 1 ? 'member' : 'members'}
        </span>
        
      </div>
      
      
      <div className="flex flex-col space-y-1.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {sortedMembers.map((member, index) => (
          <div 
            key={index} 
            className="group flex items-center cursor-pointer justify-between p-2.5 rounded-lg hover:bg-white/7 transition-all duration-200 border border-[#137aa0] hover:border-[#05b8ef]"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Profile Picture or Avatar */}
              <div className="relative flex-shrink-0">
                {member?.profilePic ? (
                  <img 
                    src={member.profilePic} 
                    alt={member.fullName} 
                    className="w-9 h-9 rounded-full object-cover border-2 border-violet-500/50 shadow-[0_0_10px_rgba(138,43,226,0.4)]" 
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-violet-500/50 shadow-[0_0_10px_rgba(138,43,226,0.4)] bg-gradient-to-br from-[#ff4800] via-pink-500 to-[#d31b74]">
                    {member?.fullName
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                )}
                
                {/* Online Status Badge */}
                <div className="absolute -bottom-0.5 -right-0.5">
                  <div className={`w-3 h-3 rounded-full border-2 border-[#1a1a2e] ${
                    onlineUsers.includes(member._id) 
                      ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' 
                      : 'bg-gray-500'
                  }`} />
                </div>
              </div>

              {/* Member Info */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white/90 text-sm font-medium truncate">
                      {member.fullName}
                    </span>
                    
                    {member._id === authUser._id && (
                      <span className="text-xs text-violet-400 font-medium">(You)</span>
                    )}
                  </div>
                  {member.role && (
                    <p className="text-xs text-white/50 truncate mt-0.5">{member.role}</p>
                  )}
                </div>

                {/* Admin Badge */}
                {selectedGrp.admins?.some(admin =>
                  (admin._id ? admin._id.toString() : admin.toString()) === member._id
                  ) && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-400/20">
                    <Crown className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] text-blue-400 font-semibold uppercase">Admin</span>
                  </div>
                )}
              </div>

              {/* Action Buttons (visible on hover for admin) */}
              {selectedGrp.admins?.some(admin =>
               (admin._id ? admin._id.toString() : admin.toString()) === authUser._id
               ) && (
                <div className="flex items-center gap-1">
                  <button 
                    className="p-1.5 rounded-md hover:bg-red-500/10 transition-colors"
                    title="Remove from group"
                  >
                    <UserMinus className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>

      <hr className="border-[#ffffff50] my-4"/>

      {/* Media Sections */}
      <MediaSection title="Media" items={msgImages} type="images" />
      <MediaSection title="Documents" items={msgDocs} type="documents" />
      <MediaSection title="Links" items={msgLinks} type="links" />
      <MediaSection title="Audio" items={msgAudios} type="audios" />
      <MediaSection title="Videos" items={msgVideos} type="videos" />

      <hr className="border-[#ffffff50] my-4"/>

      {/* Group Actions */}
      <div className="px-3 space-y-1 mb-20">
        <ProfileOption title="Pin Chat" />
        <ProfileOption title="Archive Chat" />
        <ProfileOption title="Export Chat" />
        <ProfileOption title="Share Group" />
        <ProfileOption title="Mute Notifications" />
        <ProfileOption title="Leave Group" color="text-red-400" />
        <ProfileOption title="Delete Group" color="text-red-400" />
      </div>

    </div>
  )
};

export default GroupProfileSidebar;
