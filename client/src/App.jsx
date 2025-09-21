import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Profile from './pages/Profile'
import { Toaster } from "react-hot-toast"
import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import Contacts from './pages/Contact'
import VideoCalling from './pages/VideoCalling'

const App = () => {

  const {authUser, loading} = useContext(AuthContext);

   if (loading) {
    // Show nothing or a loader until auth check completes
    return <div className="flex justify-center items-center h-screen">Loading...</div>
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

