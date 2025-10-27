import React, { useContext, useState } from 'react';
import { useNavigate } from "react-router-dom";
import assets from '../assets/assets';
import { ArrowLeft, ChevronLeft, CornerUpLeft } from "lucide-react";
import { AuthContext } from '../../context/AuthContext';
import { ChatContext } from '../../context/ChatContext';

const Profile = () => {

const {authUser, updateProfile} = useContext(AuthContext);
const { setActive } = useContext(ChatContext);
const [selectedImg, setSelectedImg] = useState(null);
const navigate = useNavigate();
const [name, setName] = useState(authUser.fullName);
const [bio, setBio] = useState(authUser.bio);
const [dob, setDob] = useState("");
const [location, setLocation] = useState("Pune, India");


  const handleSubmitProfile = async(e) => {
    e.preventDefault();
    if(!selectedImg){
      await updateProfile({fullName: name, bio});
      navigate("/");
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(selectedImg);
    reader.onload = async () => {
      const base64Image = reader.result;
      await updateProfile({profilePic: base64Image, fullName: name, bio});
      navigate("/");
    }
  }

  return (
   <div className='min-h-screen bg-cover bg-no-repeat flex items-center justify-center'>

<div className='w-5/6 max-w-2xl backdrop-blur-2xl text-gray-300 border-2 border-gray-600 flex items-center justify-between max-sm:flex-col-reverse rounded-lg'>
 <CornerUpLeft onClick={()=> {navigate('/'); setActive("My Chat")}}  className=' max-w-15 w-12 hover:bg-gradient-to-br from-[#055ea8] to-[#9702c4] border-2 p-[4px] h-9 rounded bg-[#0a15ec58] border-[#0dbad8b0] absolute top-3 right-4 cursor-pointer hover:scale-105'/>
<form onSubmit={handleSubmitProfile} className="flex flex-col gap-5 pl-10 max-md:pl-0 py-10 flex-1">

   <h3 className="text-lg">Profile details</h3>
   <label htmlFor="avatar" className='flex items-center gap-3 cursor-pointer'>
    <input onChange={(e)=>setSelectedImg(e.target.files[0])} type="file" id='avatar' accept='.png, .jpg, .jpeg' hidden/>
    <img src={selectedImg ? URL.createObjectURL(selectedImg) : assets.avatar_icon } alt="" className={`w-12 h-12 ${selectedImg && "rounded-full"}`} />
     Upload Image
   </label>
                      
     <input onChange={(e)=>setName(e.target.value)} value={name} type="text" required placeholder='Your name' className='p-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500'/>
     <textarea onChange={(e)=>setBio(e.target.value)} value={bio}
       placeholder="Write profile bio" required className="p-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500" rows={4}></textarea>
      
    <div className="flex items-center gap-3">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6 text-purple-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
    <div className="flex flex-col max-w-sm">
  <label htmlFor="dob" className="text-gray-300 text-sm">
    Date of Birth
  </label>
  <input
    type="date"
    id="dob"
    onChange={(e) => setDob(e.target.value)}
    max={new Date().toISOString().split("T")[0]} // prevent future dates
    className="p-2 cursor-pointer border border-indigo-300 rounded text-white placeholder-gray-400 outline-none focus:border-purple-500 transition-all"
    placeholder="16 December 2006 (18 yrs)"
    required
  />

  {dob && (
    <p className="text-gray-300 text-sm mt-1">
      Selected Date: {dob} ({new Date().getFullYear() - new Date(dob).getFullYear()} yrs)
    </p>
  )}
</div>

  </div>

  {/* Location */}
  <div className="flex items-center gap-3">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6 text-green-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22s8-4.5 8-10a8 8 0 10-16 0c0 5.5 8 10 8 10z" />
    </svg>
    <div className="flex flex-col">
      <label className="text-gray-300 text-sm">Location</label>
      <input className="p-2 border border-indigo-300 rounded" placeholder="Pune, India" required />
    </div>
  </div>

     <button type="submit" className="bg-gradient-to-r from-purple-400 to-violet-600 text-white p-2 rounded-full hover:opacity-80 text-lg cursor-pointer">
        Save
     </button>

</form>
<img onClick={() => navigate("/")} className={`max-w-74 cursor-pointer rounded-full max-sm:mt-10 mt-[-130px] ${selectedImg && "rounded-full"} `} src={authUser?.profilePic || assets.logo_big} alt="" />
</div>
   </div>
  )
}

export default Profile;