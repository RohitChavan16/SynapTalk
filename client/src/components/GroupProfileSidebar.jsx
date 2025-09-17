import React, { useContext, useEffect, useState } from 'react';
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
  UserCheck
} from 'lucide-react';

const GroupProfileSidebar = () => {
  const { selectedGrp, messages } = useContext(ChatContext);
  const [msgImages, setMsgImages] = useState([]);
  const [msgDocs, setMsgDocs] = useState([]);
  const [msgLinks, setMsgLinks] = useState([]);
  const [msgAudios, setMsgAudios] = useState([]);
  const [msgVideos, setMsgVideos] = useState([]);

  useEffect(() => {
    if (!selectedGrp) return;

    setMsgImages(messages.filter(msg => msg.image).map(msg => msg.image));
    setMsgDocs(messages.filter(msg => msg.document || msg.file).map(msg => msg.document || msg.file));
    setMsgLinks(messages.filter(msg => msg.link || (msg.text && msg.text.includes('http'))).map(msg => msg.link || msg.text));
    setMsgAudios(messages.filter(msg => msg.audio).map(msg => msg.audio));
    setMsgVideos(messages.filter(msg => msg.video).map(msg => msg.video));
  }, [messages, selectedGrp]);

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

  return selectedGrp && (
    <div className="bg-[#8185B2]/10 text-white w-full relative border-l-2 border-l-gray-600 h-[100%] overflow-y-scroll max-md:hidden">

      {/* Group Header */}
      <div className='pt-10 flex flex-col items-center gap-2 text-xs font-light mx-auto'>
        <img src={selectedGrp.groupPic || assets.avatar_icon} alt="" className='w-24 aspect-[1/1] rounded-full border-2 border-white/30 shadow-lg'/>
        <h1 className='px-10 text-xl font-semibold mx-auto'>{selectedGrp.name}</h1>
        {selectedGrp.description && <p className='px-10 text-white/70 text-center'>{selectedGrp.description}</p>}
        <p className='px-10 mx-auto text-white/60'>Members: {selectedGrp.members.length}</p>
      </div>

      <hr className="border-[#ffffff50] my-4"/>

      {/* Members List */}
      <div className="px-5 mb-4">
        <h2 className="text-white/80 text-sm mb-2">Group Members</h2>
        <div className="flex flex-col space-y-2 max-h-[150px] overflow-y-scroll">
          {selectedGrp.members.map((member, index) => (
            <div key={index} className="flex items-center justify-between p-2 rounded hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <img src={member.profilePic || assets.avatar_icon} alt="" className="w-8 h-8 rounded-full"/>
                <span>{member.fullName}</span>
                {member._id === selectedGrp.admin && <UserCheck className="w-4 h-4 text-blue-400" title="Admin"/>}
              </div>
              <span className="text-xs text-white/60">{member.role || ""}</span>
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
