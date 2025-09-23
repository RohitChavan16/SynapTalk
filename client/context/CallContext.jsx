// context/CallContext.jsx
import React, { createContext, useState, useContext, useRef, useEffect } from "react";
import { AuthContext } from "./AuthContext";
import { io } from "socket.io-client";

export const CallContext = createContext();

export const CallProvider = ({ children }) => {
  const { authUser } = useContext(AuthContext);
  const [isInCall, setIsInCall] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState("");
  const [remoteUserId, setRemoteUserId] = useState(null);
  
  const socket = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    if (authUser?._id && !socket.current) {
      console.log("🔄 Initializing socket for user:", authUser._id);
      
      socket.current = io("http://localhost:5001", {
        query: { userId: authUser._id },
        transports: ["websocket"]
      });

      socket.current.on("connect", () => {
        console.log("✅ Socket connected:", socket.current.id);
      });

      socket.current.on("disconnect", () => {
        console.log("❌ Socket disconnected");
      });

      socket.current.on("connect_error", (error) => {
        console.error("🔥 Socket connection error:", error);
      });

      // Listen for incoming calls
      socket.current.on("call-request", (data) => {
        console.log("📞 Incoming call received:", data);
        setIncomingCall({
          from: data.from,
          fromName: data.fromName,
          roomId: data.roomId
        });
        console.log("📞 Incoming call state set:", {
          from: data.from,
          fromName: data.fromName,
          roomId: data.roomId
        });
      });

      // Listen for call responses
      socket.current.on("call-accepted", (data) => {
        console.log("✅ Call accepted:", data);
        setCallStatus("connecting");
        setRoomId(data.roomId);
        setRemoteUserId(data.from);
        setIsInCall(true);
      });

      socket.current.on("call-rejected", (data) => {
        console.log("❌ Call rejected:", data);
        setCallStatus("rejected");
        setTimeout(() => {
          setCallStatus("");
          setRemoteUserId(null);
          setRoomId("");
        }, 2000);
      });

      socket.current.on("call-ended", (data) => {
        console.log("📞 Call ended:", data);
        handleCallEnd();
      });

      socket.current.on("call-error", (data) => {
        console.error("🔥 Call error:", data);
        setCallStatus(`Error: ${data.message}`);
      });

    } else if (!authUser?._id) {
      console.log("⚠️ No authUser found, cannot initialize socket");
    } else if (socket.current) {
      console.log("ℹ️ Socket already exists");
    }

    return () => {
      if (socket.current) {
        console.log("🔌 Disconnecting socket");
        socket.current.disconnect();
        socket.current = null;
      }
    };
  }, [authUser]);

  // Initiate a call to another user
  const handleJoinCall = (calleeId, calleeName = "Unknown") => {
    console.log("🚀 Initiating call to:", { calleeId, calleeName });
    
    if (!authUser?._id) {
      console.error("❌ No authUser found");
      return;
    }
    
    if (!calleeId) {
      console.error("❌ No calleeId provided");
      return;
    }
    
    if (!socket.current) {
      console.error("❌ Socket not connected");
      return;
    }

    if (!socket.current.connected) {
      console.error("❌ Socket not connected to server");
      return;
    }

    // Create unique room ID
    const room = `room_${[authUser._id, calleeId].sort().join("_")}`;
    
    console.log("📡 Sending call request:", {
      to: calleeId,
      from: authUser._id,
      fromName: authUser.fullName,
      roomId: room
    });

    setCallStatus("calling");
    setRemoteUserId(calleeId);
    setRoomId(room);

    // Send call request to the target user
    socket.current.emit("call-request", {
      to: calleeId,
      from: authUser._id,
      fromName: authUser.fullName,
      roomId: room
    });
  };

  // Accept incoming call
  const handleAcceptCall = () => {
    console.log("✅ Accepting call:", incomingCall);
    
    if (!incomingCall || !socket.current) {
      console.error("❌ Cannot accept call - missing data");
      return;
    }

    setCallStatus("connecting");
    setRoomId(incomingCall.roomId);
    setRemoteUserId(incomingCall.from);
    setIsInCall(true);

    // Send acceptance response
    socket.current.emit("call-accepted", {
      to: incomingCall.from,
      from: authUser._id,
      roomId: incomingCall.roomId
    });

    setIncomingCall(null);
  };

  // Reject incoming call
  const handleRejectCall = () => {
    console.log("❌ Rejecting call:", incomingCall);
    
    if (!incomingCall || !socket.current) {
      console.error("❌ Cannot reject call - missing data");
      return;
    }

    // Send rejection response
    socket.current.emit("call-rejected", {
      to: incomingCall.from,
      from: authUser._id,
      roomId: incomingCall.roomId
    });

    setIncomingCall(null);
  };

  // End call
  const handleCallEnd = () => {
    console.log("📞 Ending call");
    
    if (socket.current && roomId) {
      socket.current.emit("end-call", {
        roomId,
        reason: "user_hangup"
      });
    }

    setIsInCall(false);
    setRoomId("");
    setCallStatus("");
    setRemoteUserId(null);
    setIncomingCall(null);
  };

  // Debug logging for state changes
  useEffect(() => {
    console.log("🔄 State changed:", {
      isInCall,
      roomId,
      incomingCall: !!incomingCall,
      callStatus,
      remoteUserId,
      authUser: authUser?._id,
      socketConnected: socket.current?.connected
    });
  }, [isInCall, roomId, incomingCall, callStatus, remoteUserId, authUser]);

  return (
    <CallContext.Provider
      value={{
        isInCall,
        roomId,
        incomingCall,
        callStatus,
        remoteUserId,
        handleJoinCall,
        handleAcceptCall,
        handleRejectCall,
        handleCallEnd,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};