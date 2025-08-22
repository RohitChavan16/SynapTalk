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
  
  // -----------------------
  // Socket connection
  // -----------------------
  const connectSocket = (userData) => {
    if (!userData || socket?.connected) return;

    const newSocket = io(backendUrl, { query: { userId: userData._id } });
    newSocket.connect();
    setSocket(newSocket);

    newSocket.on("getOnlineUsers", (userIds) => setOnlineUsers(userIds));
  };

  // -----------------------
  // Check auth with backend JWT
  // -----------------------
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

  // -----------------------
  // Handle backend JWT from Google login
  // -----------------------
  const handleGoogleLogin = async () => {
    const params = new URLSearchParams(window.location.search);
    const jwtToken = params.get("token");
    if (!jwtToken) return false;

    localStorage.setItem("token", jwtToken);
    setToken(jwtToken);
    await checkAuth(jwtToken);

    // Remove token from URL
    window.history.replaceState({}, document.title, "/");
    return true;
  };

  // -----------------------
  // Manual login
  // -----------------------
  const login = async (state, credentials) => {
    try {
      const { data } = await axios.post(`/api/auth/${state}`, credentials);
      if (!data.success) {
        toast.error(data.message);
        return;
      }

      const jwtToken = data.token;
      localStorage.setItem("token", jwtToken);
      setToken(jwtToken);
      axios.defaults.headers.common["Authorization"] = `Bearer ${jwtToken}`;

      setAuthUser(data.userData);
      connectSocket(data.userData);

      if (state === "signup" && data.privateKey) {
        // Store private key as PEM string directly (don't convert)
        localStorage.setItem("privateKey", data.privateKey);
        setPrivateKey(data.privateKey);
      } else if (state === "login") {
        const storedPrivateKey = localStorage.getItem("privateKey");
        if (storedPrivateKey) {
          setPrivateKey(storedPrivateKey);
        } else {
          toast.error("Private key not found. Messages cannot be decrypted on this device.");
        }
      }

      toast.success(data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  // -----------------------
  // Logout
  // -----------------------
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("privateKey"); // Also remove private key
    setToken(null);
    setAuthUser(null);
    setPrivateKey(null);
    setOnlineUsers([]);
    axios.defaults.headers.common["Authorization"] = null;
    socket?.disconnect();
    toast.success("Logged out successfully");
  };

  // -----------------------
  // Update profile
  // -----------------------
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

  // -----------------------
  // Initialize auth on mount
  // -----------------------
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
    setPrivateKey 
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};