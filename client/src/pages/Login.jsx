import React, { useContext, useState } from 'react'
import assets from '../assets/assets';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {

  const [currState, setCurrState] = useState("Sign up");
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [bio, setBio] = useState("")
  const [isDataSubmitted, setIsDataSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const {login} = useContext(AuthContext);

  const onSubmitHandler = async (event)=>{
    setLoading(true);
    event.preventDefault();
    try {
      console.log("1");
    if (currState === 'Sign up' && !isDataSubmitted) {
       setIsDataSubmitted(true);
       setLoading(false);
       return;
    }
    console.log("2");
    const success = await login(currState === "Sign up" ? "signup" : "login", {fullName, email, password, bio});
    console.log("3");
     if (success) {
      console.log("initi navigate")
      navigate("/");
      console.log("4");
    }
    console.log("5");
    } catch (error) {
    console.error("Authentication failed:", error);
  } finally {
    console.log("7");
    setLoading(false);
  }
 }



 const handleGoogleLogin = () => {
  setGoogleLoading(true);
   const backendUrl = import.meta.env.VITE_BACKEND_URL;
  window.location.href = backendUrl + "/api/auth/google";
};


  return (
    <div className="min-h-screen bg-cover bg-center flex items-center justify-center gap-8 sm:justify-evenly max-sm:flex-col backdrop-blur-xl">
      <img src={assets.logo_big} alt="" className="w-70 max-md:item-center md:w-100" />
      <form onSubmit={onSubmitHandler} className="border-2 bg-white/8 text-white border-gray-500 p-6 flex flex-col gap-6 rounded-1g shadow-lg">
        <h2 className="font-medium text-2xl flex justify-between items-center">
          {currState}
          {isDataSubmitted &&
         <img onClick={() => setIsDataSubmitted(false)} src={assets.arrow_icon} alt="" className="w-5 cursor-pointer"/>
          }
        </h2>

{currState === "Sign up" && !isDataSubmitted && (
<input onChange={(e)=> setFullName(e.target.value)} value={fullName} type="text" className="p-2 border border-gray-500 rounded-md focus:outline-none" placeholder="Full Name" required/>
)}

{!isDataSubmitted && (
<>
<input onChange={(e)=>setEmail(e.target.value)} value={email} type="email" placeholder='Email Address' required className="p-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
<input onChange={(e)=>setPassword(e.target.value)} value={password} type="password" placeholder='Password' required className="p-2 border border-gray-500 rounded-md focus: outline-none focus:ring-2 focus:ring-indigo-500"/>
</>

)}

{currState === "Sign up" && isDataSubmitted && (

<textarea onChange={(e)=>setBio(e.target.value)} value={bio} rows={4} className='p-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500'
placeholder='provide a short bio...' required></textarea>)
}

{/* First Button */}
<button
  type="submit"     
  disabled={loading}            // disable while loading
  className="py-3 bg-gradient-to-r from-purple-400 to-violet-600 text-white rounded-md cursor-pointer hover:opacity-80 flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-60"
>
  {loading && (
    <svg
      className="animate-spin h-5 w-5 mr-2 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
    </svg>
  )}
  {currState === "Sign up" ? (loading ? "Creating..." : "Create Account") : (loading ? "Logging in..." : "Login Now")}
</button>

{/* Google Button */}
<button
  onClick={handleGoogleLogin}  // your Google handler
  disabled={googleLoading}      // disable while redirecting
  className="bg-blue-500 text-white hover:text-white hover:font-bold px-4 py-3 cursor-pointer hover:opacity-89 rounded flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-60"
>
  {googleLoading && (
    <svg
      className="animate-spin h-5 w-5 mr-2 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
    </svg>
  )}
  {googleLoading ? "Redirecting..." : "Login with Google"}
</button>

<div className="flex item-center gap-2 text-sm text-gray-300">
<input type="checkbox" />
<p>Agree to the terms of use & privacy policy.</p>
</div>
<div className='flex flex-col gap-2'>

{currState === "Sign up" ? (
<p className='text-sm text-gray-300'>Already have an account ?  
  <span onClick={() => setCurrState("Login")} className='font-medium text-violet-400 cursor-pointer'> Login here</span></p>
):(
<p className='text-sm text-gray-300'>Create an account 
  <span onClick={() => setCurrState("Sign up")} className='font-medium text-violet-400 cursor-pointer'> Click here</span></p>
)}
</div>
</form>
    </div>
  )
}

export default Login;
