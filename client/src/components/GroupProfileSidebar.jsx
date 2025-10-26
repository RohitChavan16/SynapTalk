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
  const { selectedGrp, setSelectedGrp, messages, setSelectedProfileGrp, updateGrp, users, addExtraMem, deleteMember, setActive, setSelectedUser } = useContext(ChatContext);
  const {onlineUsers, authUser} = useContext(AuthContext);
  const [msgImages, setMsgImages] = useState([]);
  const [msgDocs, setMsgDocs] = useState([]);
  const [msgLinks, setMsgLinks] = useState([]);
  const [msgAudios, setMsgAudios] = useState([]);
  const [msgVideos, setMsgVideos] = useState([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [grpName, setGrpName] = useState(selectedGrp?.name || "");
  const [grpImage, setGrpImage] = useState(selectedGrp?.groupPic);
  const [grpFile, setGrpFile] = useState(null);
  const [addMem, setAddMem] = useState(false);
    const [selectedNewGroupMembers, setSelectedNewGroupMembers] = useState([]);
  const fileInputRef = useRef(null);


  useEffect(() => {
    if (!selectedGrp) return;

    setMsgImages(messages.filter(msg => msg.image).map(msg => msg.image));
    setMsgDocs(messages.filter(msg => msg.document || msg.file).map(msg => msg.document || msg.file));
    setMsgLinks(messages.filter(msg => msg.link || (msg.text && msg.text.includes('http'))).map(msg => msg.link || msg.text));
    setMsgAudios(messages.filter(msg => msg.audio).map(msg => msg.audio));
    setMsgVideos(messages.filter(msg => msg.video).map(msg => msg.video));
  }, [messages, selectedGrp]);

  const isAdmin = selectedGrp?.admins?.some(
    (admin) => (admin._id ? admin._id.toString() : admin.toString()) === authUser._id
  );


  const ProfileOption = ({ title, subtitle, onClick, rightElement, color = "text-white" }) => (
    <div onClick={onClick} className={`flex items-center justify-between p-3 cursor-pointer hover:bg-white/10 transition-colors rounded-lg mx-2 my-1 ${color}`}>
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

  const sortedMembers = selectedGrp?.members ? [...selectedGrp.members].sort((a, b) => {
  const isAYou = a._id === authUser._id;
  const isBYou = b._id === authUser._id;

  const isAAdmin = selectedGrp?.admins?.some(admin =>
    (admin._id ? admin._id.toString() : admin.toString()) === a._id
  );
  const isBAdmin = selectedGrp?.admins?.some(admin =>
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
}) : [];


const handleSave = async (newDesc) => {
  try {
    let base64Image = null;
    console.log("Converted11")
    if (grpFile) {
      base64Image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(grpFile);
        reader.onload = () => resolve(reader.result.toString()); 
        reader.onerror = (err) => reject(err);
        console.log("Converted12")
      });
    }

    await updateGrp({
      grpId: selectedGrp._id,
      grpName,
      description: newDesc,
      grpImage1: base64Image, 
    });
    console.log("Converted13")
    setGrpFile(null);
    setIsEditingName(false);
  } catch (err) {
    toast.error("Failed to update group: " + err.message);
  }
};


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
    
    setGrpImage(URL.createObjectURL(file));  
    const base64Image = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.toString());
    reader.onerror = (err) => reject(err);
  });
  
  try {
    await updateGrp({
      grpId: selectedGrp._id,
      grpName: selectedGrp.name,
      description: selectedGrp.description,
      grpImage1: base64Image, 
    });
    toast.success("Group image updated successfully");
  } catch (err) {
    toast.error("Failed to update group image: " + err.message);
  }
  };





  const handleCheckboxChange = (member) => {
    if (selectedNewGroupMembers.includes(member)) {
      // if already selected → remove
      setSelectedNewGroupMembers(selectedNewGroupMembers.filter((m) => m !== member));
    } else {
      // if not selected → add
      setSelectedNewGroupMembers([...selectedNewGroupMembers, member]);
    }
  };





  const handleAddMem = async () => {
     if (!selectedNewGroupMembers || selectedNewGroupMembers.length === 0) {
      toast.error("Please select at least one member");
      return;
     }
     try {
      const success = await addExtraMem({mem: selectedNewGroupMembers});
      if (success) {
      setAddMem(false);
      setSelectedGrp((prevGrp) => ({
      ...prevGrp,
      members: [...prevGrp.members, ...selectedNewGroupMembers], // new array reference
      }));
      setSelectedNewGroupMembers([]);
    }
     } catch (error) {
      toast.error(error.message);
     }
  }


  const handleDeleteMem = async (deleteMem) => {
     if(!deleteMem){
      toast.success("Choose the member to delete");
      return ;
     }
     const confirmed = window.confirm(
    `Are you sure you want leave this group?`
     );
  
     if (!confirmed) return;

     try {
       const success = await deleteMember(deleteMem);
      if(success){
        setSelectedGrp((prevGrp) => {
         return {
         ...prevGrp,
         members: prevGrp.members.filter(
         (m) => m && m._id && m._id.toString() !== deleteMem.toString()
         ),
         };
        });
      }
     } catch (error) {
       toast.error(error.message);
     }
  }



  const addMember = () => {
     setAddMem(true);
  }


 const extraMembers = users.filter(
  user => !selectedGrp?.members.some(member => member._id === user._id)
);




const handleLeaveGrp = async () => { 
  console.log("Triggered");
  const confirmed = window.confirm(
    `Are you sure you want to remove this member from the group?`
     );
  
    if (!confirmed) return;
    
    const deleteMem = authUser._id;

   try {

    const success = await deleteMember(deleteMem);

      if(success){
        setSelectedGrp((prevGrp) => {
         return {
         ...prevGrp,
         members: prevGrp.members.filter(
         (m) => m && m._id && m._id.toString() !== deleteMem.toString()
         ),
         };
        });
        toast("You are no longer the member of this group");
      } 
    
   } catch (error) {
    toast.error(error.message);
   }
}






  return selectedGrp ? (
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
              onClick={() => handleSave(selectedGrp.description)}
              className="px-3 py-1.5 text-xs cursor-pointer bg-violet-600/80 hover:bg-violet-800 transition-all text-white font-medium rounded-lg flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> Save
            </button>
          </div> 
          </div>
        ) : (
        <h1 className='px-10 text-xl font-semibold mx-auto'>{selectedGrp.name}</h1>
        )}
        {selectedGrp?.admins?.some(admin =>
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
         isAdmin={selectedGrp?.admins?.some(admin =>
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
        { selectedGrp?.admins?.some(admin =>
          (admin._id ? admin._id.toString() : admin.toString()) === authUser._id) && 
        <button
        onClick={() => addMember()}  
        className="flex mb-2 gap-1 items-center cursor-pointer justify-center p-2 rounded bg-violet-600/10 border-2 border-[#ff8c20] hover:bg-violet-600/30 transition-all duration-200 group"
        >
          <UserPlus className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
          <span className="text-[14px] text-white/80 mt-1 font-medium">Add</span>
        </button>
        }
        <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded-full">
          {selectedGrp?.members.length} {selectedGrp?.members.length === 1 ? 'member' : 'members'}
        </span>
        
      </div>
      








      {addMem && <div className="absolute left-0 rounded-xl p-3 z-20 w-full h-auto bg-gradient-to-r  from-[#cc0808e9] via-[#0043a0ed] to-[#610185b4] backdrop-blur-lg">
        <p className="mb-2">Select the member to add :</p>
        <div className="flex flex-col gap-2">
          {extraMembers.map((member) => {

          return (
          <div 
            key={member._id} 
            className=" flex items-center cursor-pointer justify-between p-2.5 rounded-lg hover:bg-white/17 bg-emerald-400/10 transition-all duration-200 border border-[#137aa0] hover:border-[#05b8ef]"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">

            <input
            type="checkbox"
            id={`user-${member._id}`}
            checked={selectedNewGroupMembers.includes(member)}
            onChange={() => handleCheckboxChange(member)}
            className={`w-4 h-4 cursor-pointer `}
            />

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
              </div>

              {/* Member Info */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white/90 text-sm font-medium truncate">
                      {member.fullName}
                    </span>
                  </div>
                  {member.role && (
                    <p className="text-xs text-white/50 truncate mt-0.5">{member.role}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          )
          })}
        </div>
        <div className="flex items-center justify-center gap-6 mt-3 w-full">
          <button 
          onClick={() => {
            setSelectedNewGroupMembers([]);
            setAddMem(false)
          }}
          className="border border-[#888] px-3 py-[4px] rounded cursor-pointer hover:bg-[#8b0e27] bg-[#a20606] text-[14px]">
            Cancel
          </button>
          <button 
          onClick={() => handleAddMem()}
          className="border border-[#888] px-2 py-[3.5px] rounded cursor-pointer hover:bg-[#23762d] bg-[#008609] text-[14px]">
            Confirm
          </button>
        </div>
      </div> }









      
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
              <div onClick={() => {
                if (member._id === authUser._id) return;
                setSelectedGrp(null);
                setActive("My Chat");
                setSelectedUser(member);
                setSelectedProfileGrp(false);
              }} className="flex-1 min-w-0 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white/90 text-sm font-medium truncate">
                      {member.fullName}
                    </span>
                    
                    {member._id === authUser._id && (
                      <span className="text-xs text-violet-400 cursor-not-allowed font-medium">(You)</span>
                    )}
                  </div>
                  {member.role && (
                    <p className="text-xs text-white/50 truncate mt-0.5">{member.role}</p>
                  )}
                </div>

                {/* Admin Badge */}
                {selectedGrp?.admins?.some(admin =>
                  (admin._id ? admin._id.toString() : admin.toString()) === member._id
                  ) && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-400/20">
                    <Crown className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] text-blue-400 font-semibold uppercase">Admin</span>
                  </div>
                )}
              </div>

              {/* Action Buttons (visible on hover for admin) */}
              {selectedGrp?.admins?.some(admin =>
               (admin._id ? admin._id.toString() : admin.toString()) === authUser._id
               ) && (
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleDeleteMem(member._id)}
                    className="p-1.5 cursor-pointer rounded-md hover:bg-red-500/20 transition-colors"
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
      <p className="font-bold ml-4 text-[14px]" > Media :</p>
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
        <ProfileOption title="Leave Group" onClick={handleLeaveGrp} color="text-red-400" />
        <ProfileOption title="Delete Group" onClick={handleLeaveGrp} color="text-red-400" />
      </div>

    </div>
  ) : null
};

export default GroupProfileSidebar;
