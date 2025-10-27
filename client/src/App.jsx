import React, { useContext } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Profile from './pages/Profile'
import toast, { Toaster } from "react-hot-toast"
import { AuthContext } from '../context/AuthContext'
import Contacts from './pages/Contact'
import VideoCalling from './pages/VideoCalling'
import { CallContext } from '../context/CallContext'
import { Phone, PhoneOff } from 'lucide-react'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import assets from './assets/assets'


const App = () => {
  const { authUser, loading } = useContext(AuthContext);
  const { 
    isInCall, 
    roomId, 
    incomingCall, 
    callStatus,
    remoteUserId,
    handleCallEnd, 
    handleAcceptCall, 
    handleRejectCall 
  } = useContext(CallContext);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  // Show incoming call overlay
  const IncomingCallOverlay = () => (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-blue-600 to-purple-700 p-8 rounded-2xl text-white text-center shadow-2xl max-w-sm w-full mx-4">
        <div className="mb-6">
          <div className="w-24 h-24 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Phone size={48} className="text-white animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Incoming Call</h2>
          <p className="text-lg opacity-90">{incomingCall?.fromName || 'Unknown User'}</p>
        </div>
        
        <div className="flex justify-center gap-6">
          <button
            onClick={handleRejectCall}
            className="bg-red-500 hover:bg-red-600 p-4 rounded-full transition-all duration-300 hover:scale-110 shadow-lg"
            title="Reject Call"
          >
            <PhoneOff size={32} />
          </button>
          <button
            onClick={handleAcceptCall}
            className="bg-green-500 hover:bg-green-600 p-4 rounded-full transition-all duration-300 hover:scale-110 shadow-lg animate-pulse"
            title="Accept Call"
          >
            <Phone size={32} />
          </button>
        </div>
      </div>
    </div>
  );

  // Show calling status overlay
  const CallingStatusOverlay = () => {
    if (!callStatus || callStatus === "connected") return null;

    let statusText = "";
    let statusColor = "bg-blue-600";

    switch (callStatus) {
      case "calling":
        statusText = "Calling...";
        statusColor = "bg-blue-600";
        break;
      case "ringing":
        statusText = "Ringing...";
        statusColor = "bg-orange-500";
        break;
      case "connecting":
        statusText = "Connecting...";
        statusColor = "bg-green-600";
        break;
      case "rejected":
        statusText = "Call Rejected";
        statusColor = "bg-red-600";
        break;
      default:
        return null;
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40">
        <div className={`${statusColor} p-6 rounded-2xl text-white text-center shadow-2xl max-w-sm w-full mx-4`}>
          <div className="mb-4">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
              {callStatus === "rejected" ? (
                <PhoneOff size={32} className="text-white" />
              ) : (
                <Phone size={32} className="text-white animate-pulse" />
              )}
            </div>
            <h2 className="text-xl font-bold">{statusText}</h2>
          </div>
          
          {callStatus === "calling" && (
            <button
              onClick={handleCallEnd}
              className="bg-red-500 hover:bg-red-600 px-6 py-2 rounded-full transition-all duration-300"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  };

  // If in call, show video calling component
  if (isInCall) {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    return (
      <VideoCalling
        roomId={roomId}
        userId={authUser._id}
        remoteUserId={remoteUserId}
        onCallEnd={handleCallEnd}
        userName={authUser.fullName}
        signalingServerUrl={backendUrl}
      />
    );
  }

  return (
    <div className="bg-[url('/bgsnaptalk.avif')] bg-contain">
      <Toaster />
      
      <div className="absolute w-full mt-[7px] max-md:hidden">
       <div className="relative w-fit mx-auto rounded-[4px] p-[2px] animate-borderGlow">
       {/* This is your animated gradient border */}
       <div className="absolute inset-0 rounded-[8px] bg-gradient-to-br from-pink-500 via-indigo-500 to-orange-500 animate-gradientMove"></div>

       {/* Image inside border */}
       <img
        src={assets.SynapTalkCrop}
        className="relative rounded-[8px] h-15 w-70 "
       />
       </div>
      </div>

      {/* Incoming call overlay */}
      {incomingCall && <IncomingCallOverlay />}
      
      {/* Calling status overlay */}
      <CallingStatusOverlay />
      
      <Routes>
        <Route path="/" element={authUser ? <Home /> : <Navigate to="/login" />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/login" element={!authUser ? <Login /> : <Navigate to="/" />} />
        <Route path="/profile" element={authUser ? <Profile /> : <Navigate to="/login" />} />
        <Route path="/contacts" element={authUser ? <Contacts /> : <Navigate to="/login" />} />
        <Route path="/call" element={authUser ? <VideoCalling /> : <Navigate to="/login" />} />
      </Routes>
    </div>
  )
}

export default App;