import React, { useContext, useState } from 'react'
import assets from '../assets/assets';
import { AuthContext } from '../../context/AuthContext';

const Login = () => {

  const [currState, setCurrState] = useState("Sign up");
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [bio, setBio] = useState("")
  const [isDataSubmitted, setIsDataSubmitted] = useState(false);

  const {login} = useContext(AuthContext);

  const onSubmitHandler = (event)=>{
    event.preventDefault();
    if (currState === 'Sign up' && !isDataSubmitted) {
       setIsDataSubmitted(true);
       return;
    }
    login(currState === "Sign up" ? "signup" : "login", {fullName, email, password, bio});
 }


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

<textarea onChange={(e)=>setBio(e.target.value)} value={bio} rows={4} className='p-2 border border-gray-500 rounded-md focus: outline-none focus:ring-2 focus: ring-indigo-500'
placeholder='provide a short bio...' required></textarea>)
}

<button type='submit' className="py-3 bg-gradient-to-r from-purple-400 to-violet-600 text-white rounded-md cursor-pointer hover:opacity-80">
{currState === "Sign up" ? "Create Account": "Login Now"}
</button>
<button
  onClick={() => {
    window.location.href = "http://localhost:5001/api/auth/google";
  }}
  className="bg-blue-500 text-white hover:text-white hover:font-bold px-4 py-3 cursor-pointer hover:opacity-89 rounded"
>
  Login with Google
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
