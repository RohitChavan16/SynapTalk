import React, { useContext, useEffect, useState } from 'react'
import assets from '../assets/assets';
import { ChatContext } from '../../context/ChatContext';
import { AuthContext } from '../../context/AuthContext';
import { 
  Phone, 
  Video, 
  Search, 
  Bell, 
  BellOff, 
  Star, 
  FileText, 
  Link, 
  Users, 
  Shield, 
  Ban, 
  Trash2,
  Archive,
  Pin,
  Download,
  Share,
  ChevronRight,
  MessageSquare,
  Calendar,
  Music,
  Video as VideoIcon
} from 'lucide-react';
import { CallContext } from '../../context/CallContext';

const ProfileSidebar = () => {
  const {selectedUser, messages, setSelectedProfile} = useContext(ChatContext);
  const {logout, onlineUsers} = useContext(AuthContext);
  const [msgImages, setMsgImages] = useState([]);
  const [msgDocs, setMsgDocs] = useState([]);
  const [msgLinks, setMsgLinks] = useState([]);
  const [msgAudios, setMsgAudios] = useState([]);
  const [msgVideos, setMsgVideos] = useState([]);
  const [isNotificationMuted, setIsNotificationMuted] = useState(false);
  const { handleJoinCall, isInCall } = useContext(CallContext);

  const profileUserId = selectedUser?._id;

  const onCallClick = () => {
    if (!profileUserId) return;
    handleJoinCall(profileUserId, selectedUser.fullName);
  };
  
  useEffect(()=>{
    setMsgImages(
      messages.filter(msg => msg.image).map(msg=>msg.image)
    );
    
    // Filter other media types if they exist in your messages
    setMsgDocs(
      messages.filter(msg => msg.document || msg.file).map(msg => msg.document || msg.file)
    );
    
    setMsgLinks(
      messages.filter(msg => msg.link || (msg.text && msg.text.includes('http'))).map(msg => msg.link || msg.text)
    );
    
    setMsgAudios(
      messages.filter(msg => msg.audio).map(msg => msg.audio)
    );
    
    setMsgVideos(
      messages.filter(msg => msg.video).map(msg => msg.video)
    );
  }, [messages]);

  const ProfileOption = ({ icon: Icon, title, subtitle, onClick, rightElement, color = "text-white", bgHover = "hover:bg-white/10" }) => (
    <div className={`flex items-center justify-between p-3 cursor-pointer ${bgHover} transition-colors rounded-lg mx-2 my-1`} onClick={onClick}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${color}`} />
        <div className="flex flex-col">
          <span className={`font-medium ${color} text-sm`}>{title}</span>
          {subtitle && <span className="text-xs text-white/60">{subtitle}</span>}
        </div>
      </div>
      {rightElement}
    </div>
  );

  const MediaSection = ({ title, icon: Icon, items, type }) => (
    items.length > 0 && (
      <div className="px-5 text-xs mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-white/80" />
            <p className="text-white/80">{title}</p>
            <span className="text-white/60">({items.length})</span>
          </div>
          <button className="text-blue-300 hover:text-blue-200 text-xs">View All</button>
        </div>
        
        <div className='mt-2 max-h-[150px] overflow-y-scroll grid grid-cols-2 gap-2 opacity-80'>
          {items.slice(0, 6).map((item, index) => (
            <div key={index} onClick={() => window.open(item)} className='cursor-pointer rounded bg-white/10 hover:bg-white/20 transition-colors'>
              {type === 'images' && (
                <img src={item} alt="" className='h-20 w-full object-cover rounded-md'/>
              )}
              {type === 'documents' && (
                <div className="h-20 flex flex-col items-center justify-center rounded-md">
                  <FileText className="w-6 h-6 text-blue-300 mb-1" />
                  <span className="text-xs text-white/70 truncate px-1">Document</span>
                </div>
              )}
              {type === 'videos' && (
                <div className="h-20 flex flex-col items-center justify-center rounded-md bg-gray-800/50">
                  <VideoIcon className="w-6 h-6 text-red-300 mb-1" />
                  <span className="text-xs text-white/70">Video</span>
                </div>
              )}
              {type === 'audios' && (
                <div className="h-20 flex flex-col items-center justify-center rounded-md bg-green-800/30">
                  <Music className="w-6 h-6 text-green-300 mb-1" />
                  <span className="text-xs text-white/70">Audio</span>
                </div>
              )}
              {type === 'links' && (
                <div className="h-20 flex flex-col items-center justify-center rounded-md bg-purple-800/30">
                  <Link className="w-6 h-6 text-purple-300 mb-1" />
                  <span className="text-xs text-white/70 truncate px-1">Link</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  );

  return selectedUser && (
    <div className={`bg-[#8185B2]/10 text-white w-full relative border-l-2 border-l-gray-600 h-[100%] overflow-y-scroll `}>
      <button
        className="absolute top-3 right-3 p-2 text-white md:hidden"
        onClick={() => setSelectedProfile(false)}
      >
        X
      </button>
      {/* Existing Profile Header - Unchanged */}
      <div className='pt-10 flex flex-col items-center gap-2 text-xs font-light mx-auto'>
        {selectedUser?.profilePic ? (
                <img
                src={selectedUser.profilePic}
                alt={selectedUser.fullName}
                className="w-[98px] h-[98px] rounded-full object-cover border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)]"
                />
               ) : (
                     <div className="w-[98px] h-[98px] rounded-full flex items-center justify-center 
                      text-white text-3xl font-bold border border-violet-500 shadow-[0_0_8px_rgba(138,43,226,0.7)] 
                      bg-gradient-to-r from-[#ff4800] via-pink-500 to-[#d31b74]">
                      {selectedUser?.fullName
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                     </div>
                    )}
        <h1 className='px-10 text-xl font-medium mx-auto flex items-center gap-2'>
          {onlineUsers.includes(selectedUser._id) && <p className='w-2 h-2 rounded-full bg-green-500'></p>}
          {selectedUser.fullName}
        </h1>
        <p className='px-10 mx-auto'>{selectedUser.bio}</p>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center justify-around py-4 px-5">
        <button className="flex flex-col items-center cursor-pointer gap-1 p-2 hover:bg-white/10 rounded-lg transition-colors">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs text-white/70">Audio</span>
        </button>
        <button onClick={onCallClick} disabled={isInCall} className="flex flex-col cursor-pointer items-center gap-1 p-2 hover:bg-white/10 rounded-lg transition-colors">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <Video className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs text-white/70">Video</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 cursor-pointer hover:bg-white/10 rounded-lg transition-colors">
          <div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center">
            <Search className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs text-white/70">Search</span>
        </button>
      </div>

      <hr className="border-[#ffffff50] my-4"/>

      {/* Enhanced Media Sections */}
      <MediaSection title="Media" icon={VideoIcon} items={msgImages} type="images" />
      <MediaSection title="Documents" icon={FileText} items={msgDocs} type="documents" />
      <MediaSection title="Links" icon={Link} items={msgLinks} type="links" />
      <MediaSection title="Audio" icon={Music} items={msgAudios} type="audios" />
      <MediaSection title="Videos" icon={VideoIcon} items={msgVideos} type="videos" />

      {/* Original Media Section - Enhanced */}
      {msgImages.length > 0 && (
        <div className="px-5 text-xs mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/80">All Media ({msgImages.length})</p>
            <button className="text-blue-300 hover:text-blue-200 text-xs">View All</button>
          </div>
          <div className='mt-2 max-h-[200px] overflow-y-scroll grid grid-cols-2 gap-4 opacity-80'>
            {msgImages.map((url, index)=>(
              <div key={index} onClick={()=> window.open(url)} className='cursor-pointer rounded hover:scale-105 transition-transform'>
                <img src={url} alt="" className='h-full rounded-md'/>
              </div>
            ))}
          </div>
        </div>
      )}

      <hr className="border-[#ffffff50] my-4"/>

      {/* Profile Options */}
      <div className="px-3 space-y-1">
        <ProfileOption 
          icon={Star} 
          title="Starred Messages" 
          subtitle={`${messages.filter(msg => msg.starred).length} messages`}
          rightElement={<ChevronRight className="w-4 h-4 text-white/40" />}
        />
        
        <ProfileOption 
          icon={Users} 
          title="Groups in Common" 
          subtitle="3 groups"
          rightElement={<ChevronRight className="w-4 h-4 text-white/40" />}
        />

        <ProfileOption 
          icon={MessageSquare} 
          title="Chat History" 
          subtitle={`${messages.length} messages`}
          rightElement={<ChevronRight className="w-4 h-4 text-white/40" />}
        />

        <ProfileOption 
          icon={Calendar} 
          title="Disappearing Messages" 
          subtitle="Off"
          rightElement={<ChevronRight className="w-4 h-4 text-white/40" />}
        />

        <ProfileOption 
          icon={isNotificationMuted ? BellOff : Bell}
          title="Mute Notifications"
          onClick={() => setIsNotificationMuted(!isNotificationMuted)}
          rightElement={
            <div className={`w-10 h-5 rounded-full transition-colors ${isNotificationMuted ? 'bg-green-500' : 'bg-gray-400'} relative`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${isNotificationMuted ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
            </div>
          }
        />

        <ProfileOption 
          icon={Pin} 
          title="Pin Chat"
          rightElement={<ChevronRight className="w-4 h-4 text-white/40" />}
        />

        <ProfileOption 
          icon={Archive} 
          title="Archive Chat"
          rightElement={<ChevronRight className="w-4 h-4 text-white/40" />}
        />

        <ProfileOption 
          icon={Download} 
          title="Export Chat"
          rightElement={<ChevronRight className="w-4 h-4 text-white/40" />}
        />

        <ProfileOption 
          icon={Share} 
          title="Share Contact"
          rightElement={<ChevronRight className="w-4 h-4 text-white/40" />}
        />
      </div>

      <hr className="border-[#ffffff50] my-4"/>

      {/* Danger Zone */}
      <div className="px-3 space-y-1 mb-20">
        <ProfileOption 
          icon={Shield} 
          title="Block Contact"
          color="text-red-400"
          bgHover="hover:bg-red-500/10"
          rightElement={<ChevronRight className="w-4 h-4 text-red-400/60" />}
        />
        
        <ProfileOption 
          icon={Ban} 
          title="Report Contact"
          color="text-red-400"
          bgHover="hover:bg-red-500/10"
          rightElement={<ChevronRight className="w-4 h-4 text-red-400/60" />}
        />

        <ProfileOption 
          icon={Trash2} 
          title="Delete Chat"
          color="text-red-400"
          bgHover="hover:bg-red-500/10"
          rightElement={<ChevronRight className="w-4 h-4 text-red-400/60" />}
        />
      </div>

    
    </div>
  )
}

export default ProfileSidebar;