import React, { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Profile from './pages/Profile'
import toast, { Toaster } from "react-hot-toast"
import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import Contacts from './pages/Contact'
import VideoCalling from './pages/VideoCalling'
import axios from 'axios'
import { CallContext } from '../context/CallContext'

const App = () => {

  const {authUser, loading} = useContext(AuthContext);
const { isInCall, roomId, handleCallEnd } = useContext(CallContext);

if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (isInCall) {
    return (
      <VideoCalling
        roomId={roomId}
        userId={authUser._id}
        onCallEnd={handleCallEnd}
        userName={authUser.fullName}
      />
    );
  }



  return (
    <div className="bg-[url('./src/assets/bgsnaptalk.avif')] bg-contain">
      <Toaster/>
    <Routes>
        <Route path="/" element={authUser ? <Home /> : <Navigate to="/login" />} />
        <Route path="/login" element={!authUser ? <Login /> : <Navigate to="/" />} />
        <Route path="/profile" element={authUser ? <Profile /> : <Navigate to="/login" />} />
        <Route path="/contacts" element={authUser ? <Contacts /> : <Navigate to="/login" />} />
        <Route path="/call" element={authUser ? <VideoCalling /> : <Navigate to="/login" />} />
      </Routes>
    </div>
  )
}

export default App

