import React, { useState, useEffect } from 'react';
import { Phone, MessageCircle, Mail, Bell, Calendar, Server, AlertCircle, StoreIcon, LucideAreaChart } from 'lucide-react';

const NotificationOptions = ({ value, onChange }) => {
  const [selected, setSelected] = useState("all");

  useEffect(() => {
    if (value) setSelected(value);
  }, [value]);

  const OPTIONS = [
    { key: 'all', label: 'All', desc: 'All your notifications', Icon: AlertCircle },
    { key: 'chat', label: 'Chat', desc: 'Direct messages & group chat', Icon: MessageCircle },
    { key: 'call', label: 'Call', desc: 'Missed & incoming calls', Icon: Phone },
    { key: 'account', label: 'Account', desc: 'Actions taken on your account', Icon: Bell },
    { key: 'system', label: 'System', desc: 'Updates, maintenance & Announcement', Icon: Server },
     { key: 'story', label: 'Status/Story', desc: 'Status or Story info', Icon: LucideAreaChart },
  ];


  return (
    <div className="grid grid-cols-3 gap-4 p-4 rounded-2xl shadow-md">
      {OPTIONS.map(({ key, label, desc, Icon }) => {
        
        return (
          <button
            key={key}
            onClick={() => setSelected(key)}
            className={`flex flex-col items-center cursor-pointer p-3 rounded-xl transition-all  text-center hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
              selected === key ? 'bg-gradient-to-br from-[#006df1b9] to-[#11c2f39a] text-white' : 'bg-gradient-to-br from-[#f30b0bae] to-[#0390b7ad] text-indigo-200'
            }`}
          >
            <div className={`p-2 rounded-full mb-2 ${selected === key ? 'bg-white/20' : 'bg-neutral-50  text-gray-800'}`}>
              <Icon className="w-5 h-5"/>
            </div>
            <span className="font-semibold text-sm">{label}</span>
            <span className="text-xs opacity-70 mt-1">{desc}</span>
          </button>
        );
      })}
    </div>
  );
};

export default NotificationOptions;