import { createContext, useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
axios.defaults.baseURL = backendUrl;

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [authUser, setAuthUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [privateKey, setPrivateKey] = useState(localStorage.getItem("privateKey"));
  const [socialLinks, setSocialLinks] = useState([]);


  // Socket connection

  const connectSocket = (userData) => {
    if (!userData) return;
    if (socket?.connected) {
    console.log("🔌 Disconnecting existing socket");
    socket.disconnect();
  }
    console.log("🔌 Creating new socket connection for user:", userData._id);
      const newSocket = io(backendUrl, {
    query: { userId: userData._id },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    autoConnect: false // ✅ Don't auto-connect yet
  });
    newSocket.connect();
    setSocket(newSocket);

    newSocket.on("getOnlineUsers", (userIds) => setOnlineUsers(userIds));
  };


  const checkAuth = async (jwtToken) => {
    try {
      if (!jwtToken) return false;
      axios.defaults.headers.common["Authorization"] = `Bearer ${jwtToken}`;
      const { data } = await axios.get("/api/auth/check");
      if (data.success) {
        setAuthUser(data.user);
        connectSocket(data.user);
        return true;
      }
      return false;
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return false;
    }
  };
 


  
 const handleGoogleLogin = async () => {
  const params = new URLSearchParams(window.location.search);
  const jwtToken = params.get("token");
  const privateKeyParam = params.get("privateKey");
  const isNewUser = params.get("newUser");
  const authError = params.get("error");
  
  if (authError) {
    toast.error("Google authentication failed. Please try again.");
    window.history.replaceState({}, document.title, "/");
    return false;
  }
  
  if (!jwtToken) return false;

  localStorage.setItem("token", jwtToken);
  setToken(jwtToken);
  
  if (isNewUser === "true" && privateKeyParam) {
    console.log("🔑 Storing private key for new Google user");
    const decodedPrivateKey = decodeURIComponent(privateKeyParam);
    localStorage.setItem("privateKey", decodedPrivateKey);
    setPrivateKey(decodedPrivateKey);
    toast.success("Account created! Private key stored securely.");
  } else {

    const storedKey = localStorage.getItem("privateKey");
    if (storedKey) {
      setPrivateKey(storedKey);
      console.log("✅ Private key found locally");
    } else {
      console.warn("⚠️ No private key found on this device");
      toast.warning("Private key not found on this device. Messages cannot be decrypted.");
    }
  }
  
  await checkAuth(jwtToken);

  window.history.replaceState({}, document.title, "/");
  return true;
 };

  // -----------------------
  // Manual login
  
  const login = async (state, credentials) => {
    try {
      const { data } = await axios.post(`/api/auth/${state}`, credentials);
      if (!data.success) {
        toast.error(data.message);
        return false;
      }

      const jwtToken = data.token;
      localStorage.setItem("token", jwtToken);
      setToken(jwtToken);
      axios.defaults.headers.common["Authorization"] = `Bearer ${jwtToken}`;

      setAuthUser(data.userData);
     setTimeout(() => connectSocket(data.userData), 0);

      if (state === "signup" && data.privateKey) {
        // Store private key as PEM string directly (don't convert)
        localStorage.setItem("privateKey", data.privateKey);
        setPrivateKey(data.privateKey);
        toast.success("Private key stored");
      } else if (state === "login") {
        const storedPrivateKey = localStorage.getItem("privateKey");
        if (storedPrivateKey) {
          setPrivateKey(storedPrivateKey);
        } else {
          toast.error("Private key not found. Messages cannot be decrypted on this device.");
        }
      }

      toast.success(data.message);
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return false;
    }
  };

  
  // Logout
  
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setAuthUser(null);
    setPrivateKey(null);
    setOnlineUsers([]);
    axios.defaults.headers.common["Authorization"] = null;
    socket?.disconnect();
    toast.success("Logged out successfully");
  };

  
  // Update profile
  
  const updateProfile = async (body) => {
    try {
      const { data } = await axios.put("/api/auth/update-profile", body);
      if (data.success) {
        setAuthUser(data.user);
        toast.success("Profile updated successfully");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const getSocialLink = async () => {
        try{
          const { data } = await axios.get("/api/auth/social-links");
          if(data.success){
             setSocialLinks(data.socialLink);
          } else {
            toast.error(data.message);
          }
        } catch (error) {
          toast.error("Unable to get the Social Links");
        }
    }

    const deleteSocialLink = async (platform) => {
       try {
         const token = localStorage.getItem("token");
         const { data } = await axios.delete("/api/auth/delete-links", { headers: { Authorization: `Bearer ${token}` }, data : { platform },
        });
         if(data.success){
            setSocialLinks(data.socialLink);
            toast.success("Deleted it successfully");
         } else {
          toast.error(data.message);
         }
       } catch (error) {
        toast.error("Unable to delete the Social Links");
       }
    }

     const addSocialLink = async (addSocial) => {
        try {
         const {data} = await axios.post("/api/auth/add-links", {...addSocial});
         if(data.success){
            setSocialLinks(data.socialLink);
            toast.success("Link Added successfully");
         } else {
          toast.error(data.message);
         }
       } catch (error) {
        toast.error("Unable to add the Social Links");
       }
    }

     const editSocialLink = async (editSocial) => {
        try {
         const {data} = await axios.put("/api/auth/edit-links", {...editSocial});
         if(data.success){
             setSocialLinks(data.socialLink);
            toast.success("Editied it successfully");
         } else {
          toast.error(data.message);
         }
       } catch (error) {
        toast.error("Unable to edit the Social Links");
       }
     }

  
  // Initialize auth on mount
  
  useEffect(() => {
    const initAuth = async () => {
      const googleLoggedIn = await handleGoogleLogin();
      if (!googleLoggedIn && token) {
        await checkAuth(token);
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const value = {
    axios,
    authUser,
    onlineUsers,
    socket,
    login,
    logout,
    updateProfile,
    loading,
    token,
    privateKey,
    setPrivateKey,
    socialLinks,
    setSocialLinks,
    getSocialLink,
    deleteSocialLink,
    addSocialLink,
    editSocialLink
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};